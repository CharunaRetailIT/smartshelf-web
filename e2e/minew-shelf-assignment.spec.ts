import { test, expect, Page } from '@playwright/test';
import { HW, API_URL, login, authToken, expectToast } from './fixtures';

/**
 * Aisle -> shelf -> product assignment, then binding the label from the
 * assignment page's Devices tab (the pre-existing Quick Bind / Bind with
 * Message actions this project already shipped).
 *
 * By default this picks up the newest product the lifecycle spec created;
 * set E2E_PRODUCT_NAME to pin it to a specific one instead.
 */
test.describe.configure({ mode: 'serial' });

/** Newest "E2E Minew ..." product, so this spec can run straight after the other. */
async function resolveProduct(
  page: Page,
): Promise<{ id: number; name: string }> {
  const pinned = process.env['E2E_PRODUCT_NAME'];
  const token = await authToken(page);

  const res = await page.request.fetch(
    `${API_URL}/products?pageNumber=1&pageSize=50&searchTerm=${encodeURIComponent(pinned || 'E2E Minew')}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok()) throw new Error(`product lookup failed: ${res.status()}`);

  const body = await res.json();
  const items: any[] = body?.result?.items ?? body?.items ?? [];
  if (!items.length)
    throw new Error(
      'no E2E product found - run minew-esl-lifecycle.spec.ts first',
    );

  const newest = items.sort((a, b) => b.id - a.id)[0];
  return { id: newest.id, name: newest.productName };
}

/**
 * Aisles collapse their shelves by default. Expand aisles until one reveals a
 * shelf, then open that shelf's product-assignment page. Both controls are
 * icon-only, so they're addressed by aria-label / title rather than text.
 */
async function openFirstShelfAssignment(page: Page): Promise<void> {
  await page.goto('/aisle-management');

  // These shelf actions are icon-only buttons whose accessible name comes out
  // empty in the a11y tree, so match the title attribute directly.
  const assign = page.locator('button[title="Assign Products"]');

  // Expand aisles one at a time - the first may legitimately have no shelves.
  const expanders = page.getByRole('button', { name: /Expand shelves/i });
  await expect(expanders.first()).toBeVisible({ timeout: 30_000 });

  const count = await expanders.count();
  for (let i = 0; i < count; i++) {
    await expanders.nth(0).click();
    await page.waitForTimeout(800);
    if (await assign.first().isVisible().catch(() => false)) break;
  }

  await expect(
    assign.first(),
    'an aisle with at least one shelf exists',
  ).toBeVisible({ timeout: 30_000 });

  await assign.first().click();
  await page.waitForURL(/\/product-assignment\/\d+/, { timeout: 30_000 });
}

test.describe('Shelf assignment and bind', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('assigns the product to a shelf under an aisle', async ({ page }) => {
    const { name: PRODUCT_NAME } = await resolveProduct(page);
    console.log(`using product: ${PRODUCT_NAME}`);

    await openFirstShelfAssignment(page);

    // --- Assign Products tab -> By Product ---
    await page.getByRole('tab', { name: /Assign Products/i }).click();
    await page.getByRole('tab', { name: /By Product/i }).click();

    const search = page.getByPlaceholder('Search products...').first();
    await search.fill(PRODUCT_NAME);
    await page.waitForTimeout(1500); // debounced server search

    // The two panels are near-identical, so scope by their headers rather than
    // matching product text across the whole page.
    const availablePanel = page
      .locator('p-card')
      .filter({ hasText: 'Available Products' })
      .first();
    const assignedPanel = page
      .locator('p-card')
      .filter({ hasText: 'Assigned Products' })
      .first();

    const inAvailable = availablePanel
      .getByText(PRODUCT_NAME, { exact: true })
      .first();

    // Re-runs hit a product this spec already assigned, so treat "already on
    // the shelf" as success rather than failing on an empty Available list.
    if (!(await inAvailable.isVisible({ timeout: 10_000 }).catch(() => false))) {
      await expect(
        assignedPanel.getByText(PRODUCT_NAME, { exact: true }).first(),
        'product is already assigned to this shelf',
      ).toBeVisible({ timeout: 15_000 });
      return;
    }

    // Rows are plain divs with a click handler - clicking the name bubbles up
    // to it and toggles selection.
    await inAvailable.click();

    const assignButton = page.locator(
      'p-button[pTooltip="Assign Selected"] button',
    );
    await expect(assignButton).toBeEnabled({ timeout: 15_000 });
    await assignButton.click();

    await expectToast(page, /assign/i);

    // The row must actually move across, not just fire a toast.
    await expect(
      assignedPanel.getByText(PRODUCT_NAME, { exact: true }).first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test('binds the label from the assignment Devices tab', async ({ page }) => {
    const { name: PRODUCT_NAME } = await resolveProduct(page);

    // Land back on the shelf we just assigned to.
    await openFirstShelfAssignment(page);

    await page.getByRole('tab', { name: /Devices/i }).click();

    // Under "Product Devices" each product is a collapsed accordion; expand
    // ours to reveal its device cards.
    const productGroup = page
      .getByRole('button', { name: new RegExp(PRODUCT_NAME) })
      .first();
    await expect(productGroup).toBeVisible({ timeout: 30_000 });
    await productGroup.click();

    // The expanded region lists one entry per DeviceAssignment, so this device
    // appears twice - once for its TEMPLATE row and once for its MESSAGE row.
    // Bind from the TEMPLATE row: bind-unified resolves ComboId against
    // DeviceTemplateCombos, so the MESSAGE row's combo id is not valid there.
    const region = page
      .getByRole('region', { name: new RegExp(PRODUCT_NAME) })
      .first();
    await expect(region).toBeVisible({ timeout: 30_000 });
    await expect(region.getByText(HW.deviceMac).first()).toBeVisible();

    const bindResponse = page.waitForResponse(
      (r) => r.url().includes('/device/bind-unified'),
      { timeout: 120_000 },
    );

    // Icon-only buttons carry their meaning in pTooltip, not an accessible name.
    await region.locator('p-button[pTooltip="Quick Bind"] button').first().click();

    // A confirmation dialog guards the bind.
    const confirm = page.getByRole('button', { name: /Yes, Bind/i });
    if (await confirm.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await confirm.click();
    }

    const response = await bindResponse;
    expect(
      response.ok(),
      `bind failed: ${response.status()} ${await response.text().catch(() => '')}`,
    ).toBeTruthy();
  });
});
