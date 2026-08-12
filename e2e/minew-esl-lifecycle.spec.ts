import { test, expect, Page } from '@playwright/test';
import {
  HW,
  API_URL,
  OVERLAY,
  OPTION,
  login,
  runId,
  selectFromDropdown,
  expectToast,
  authToken,
} from './fixtures';

/**
 * End-to-end lifecycle for the one Minew label available for testing:
 *
 *   create product -> attach Minew ESL (device + template + message)
 *     -> reopen and verify both assignment rows persisted
 *     -> sync products to the Minew cloud
 *     -> bind product data to the physical label (with and without message)
 *     -> assign the product to a shelf and bind from the assignment page
 *     -> schedule a queue and confirm the background processor executes it
 *
 * The steps share state (product id, shelf id), so they run serially in order.
 */
test.describe.configure({ mode: 'serial' });

const RUN = runId();
const PRODUCT_NAME = `E2E Minew ${RUN}`;
const PRODUCT_CODE = `E2E-${RUN}`;

/** Populated by the create step, consumed by everything after it. */
let productId = 0;

test.describe('Minew ESL product lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('creates a product with a Minew ESL assignment', async ({ page }) => {
    await page.goto('/products/create');

    // --- Product Details tab ---
    await page
      .locator('input[formcontrolname="productName"]')
      .fill(PRODUCT_NAME);
    await page
      .locator('input[formcontrolname="productCode"]')
      .fill(PRODUCT_CODE);

    // Category is required; any active category will do for this flow.
    const categoryTrigger = page
      .locator('p-dropdown[formcontrolname="categoryId"]')
      .first();
    await categoryTrigger.click();
    const categoryPanel = page.locator(OVERLAY).last();
    await categoryPanel.waitFor({ state: 'visible' });
    const firstCategory = categoryPanel.locator(OPTION).first();
    await expect(firstCategory).toBeVisible({ timeout: 20_000 });
    await firstCategory.click();

    // --- ESL Assignment tab ---
    await page.getByRole('tab', { name: /ESL Assignment/ }).click();

    const row = page.locator('.assignment-builder').first();
    await expect(row).toBeVisible();

    // Brand drives which devices load - Minew must be picked before the
    // device dropdown has anything in it (devices are filtered by DeviceType).
    await selectFromDropdown(
      page,
      row.locator('p-dropdown[formcontrolname="brandId"]'),
      HW.brand,
    );

    // Device list only populates after the brand is chosen. Filtering by the
    // full MAC also guards the filterBy="deviceName,mac" fix - without it
    // PrimeNG's client-side filter matched only the label and hid every row.
    await selectFromDropdown(
      page,
      row.locator('p-dropdown[formcontrolname="deviceId"]'),
      HW.deviceMac,
      { filter: true },
    );

    await selectFromDropdown(
      page,
      row.locator('p-dropdown[formcontrolname="templateId"]'),
      HW.template,
      { filter: true },
    );

    await selectFromDropdown(
      page,
      row.locator('p-dropdown[formcontrolname="messageId"]'),
      HW.message,
      { filter: true },
    );

    // Saving writes ProductMaster + DeviceTemplateCombos + DeviceMessageCombos
    // + two DeviceAssignment rows (TEMPLATE and MESSAGE) in one transaction.
    const saveResponse = page.waitForResponse(
      (r) =>
        r.url().includes('/api/products') &&
        ['POST', 'PUT'].includes(r.request().method()),
    );
    await page.getByRole('button', { name: 'Save Product' }).click();

    const response = await saveResponse;
    expect(
      response.ok(),
      `save failed: ${response.status()} ${await response.text().catch(() => '')}`,
    ).toBeTruthy();

    const body = await response.json().catch(() => null);
    productId = body?.result?.id ?? body?.id ?? 0;
    expect(productId, 'product id returned by save').toBeGreaterThan(0);

    // Saving returns to the product list.
    await page.waitForURL(/\/product-management/, { timeout: 30_000 });
  });

  test('persists both TEMPLATE and MESSAGE assignment rows', async ({
    page,
  }) => {
    test.skip(!productId, 'create step did not yield a product id');

    // The form merges the two DeviceAssignment rows back into one UI row by
    // deviceId - if either row was lost on save, a field here comes back empty.
    await page.goto(`/products/edit/${productId}`);
    await page.getByRole('tab', { name: /ESL Assignment/ }).click();

    const row = page.locator('.assignment-builder').first();
    await expect(row).toBeVisible();

    await expect(row.locator('p-dropdown[formcontrolname="brandId"]')).toContainText(
      HW.brand,
      { timeout: 30_000 },
    );
    await expect(
      row.locator('p-dropdown[formcontrolname="templateId"]'),
    ).toContainText(HW.template);
    await expect(
      row.locator('p-dropdown[formcontrolname="messageId"]'),
    ).toContainText(HW.message);
  });

  test('syncs products to the Minew cloud', async ({ page }) => {
    await page.goto('/product-management');

    const syncResponse = page.waitForResponse(
      (r) => r.url().includes('/sync') && r.request().method() === 'POST',
      { timeout: 120_000 },
    );
    await page.getByRole('button', { name: /Sync to Cloud/i }).click();

    const response = await syncResponse;
    expect(
      response.ok(),
      `cloud sync failed: ${response.status()} ${await response.text().catch(() => '')}`,
    ).toBeTruthy();
  });

  test('binds product data to the physical label from the product form', async ({
    page,
  }) => {
    test.skip(!productId, 'create step did not yield a product id');

    await page.goto(`/products/edit/${productId}`);
    await page.getByRole('tab', { name: /ESL Assignment/ }).click();

    const row = page.locator('.assignment-builder').first();
    await expect(row).toBeVisible();

    // Bind buttons only render for Minew rows and stay disabled until the
    // DeviceTemplateCombos row exists - which it does now, post-save.
    const quickBind = row.getByRole('button', { name: 'Quick Bind' });
    await expect(quickBind).toBeVisible();
    await expect(quickBind).toBeEnabled({ timeout: 20_000 });

    const bindResponse = page.waitForResponse(
      (r) => r.url().includes('/device/bind-unified'),
      { timeout: 120_000 },
    );
    await quickBind.click();

    const response = await bindResponse;
    expect(
      response.ok(),
      `quick bind failed: ${response.status()} ${await response.text().catch(() => '')}`,
    ).toBeTruthy();
    await expectToast(page, /bound/i);
  });

  test('binds product data together with the message image', async ({
    page,
  }) => {
    test.skip(!productId, 'create step did not yield a product id');

    await page.goto(`/products/edit/${productId}`);
    await page.getByRole('tab', { name: /ESL Assignment/ }).click();

    const row = page.locator('.assignment-builder').first();
    const bindWithMessage = row.getByRole('button', {
      name: 'Bind with Message',
    });
    await expect(bindWithMessage).toBeEnabled({ timeout: 20_000 });

    const bindResponse = page.waitForResponse(
      (r) => r.url().includes('/device/bind-unified'),
      { timeout: 120_000 },
    );
    await bindWithMessage.click();

    const response = await bindResponse;
    expect(
      response.ok(),
      `message bind failed: ${response.status()} ${await response.text().catch(() => '')}`,
    ).toBeTruthy();

    // A message bind must actually carry the image, otherwise the label shows
    // the template only and the bug is invisible from the UI.
    const payload = await response.json().catch(() => null);
    expect(payload?.hasImage, 'bind response reports an image was sent').toBeTruthy();
  });
});

/**
 * Binding through a DeviceMessageCombos id. The server used to look every
 * ComboId up in DeviceTemplateCombos regardless of origin; because both tables
 * have independent identity columns the same number exists in each, so a
 * message combo could silently resolve to an unrelated template combo and bind
 * the wrong label. ComboType now disambiguates.
 */
test.describe('Binding by combo type', () => {
  test('binds correctly when the id is a MESSAGE combo', async ({ page }) => {
    test.skip(!productId, 'create step did not yield a product id');

    await login(page);
    const token = await authToken(page);

    const res = await page.request.fetch(
      `${API_URL}/device/assignments/paged?PageNumber=1&PageSize=50&LocationType=Product&LocationId=${productId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const items = (await res.json())?.result?.items ?? [];
    const messageRow = items.find((a: any) => a.assignmentType === 'MESSAGE');
    const templateRow = items.find((a: any) => a.assignmentType === 'TEMPLATE');
    expect(messageRow?.deviceMessageComboId, 'message combo exists').toBeTruthy();

    const bind = async (body: Record<string, unknown>) =>
      page.request.fetch(`${API_URL}/device/bind-unified`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {
          bindingType: 'product',
          productId,
          messageId: 0,
          color: 1,
          total: 5,
          period: 500,
          interval: 900,
          brightness: 100,
          ...body,
        },
      });

    // A message combo id, correctly typed, resolves the device's template and
    // defaults the image to that combo's own message.
    const typed = await bind({
      comboId: messageRow.deviceMessageComboId,
      comboType: 'MESSAGE',
    });
    expect(
      typed.ok(),
      `MESSAGE-typed bind failed: ${typed.status()} ${await typed.text().catch(() => '')}`,
    ).toBeTruthy();

    const payload = await typed.json();
    expect(
      payload?.hasImage,
      'MESSAGE combo bind carries its own message image',
    ).toBeTruthy();

    // Omitting comboType keeps the old TEMPLATE meaning for existing callers.
    const untyped = await bind({ comboId: templateRow.deviceTemplateComboId });
    expect(
      untyped.ok(),
      `default TEMPLATE bind failed: ${untyped.status()}`,
    ).toBeTruthy();
  });
});

/**
 * Scheduling path. Verified against the API rather than the UI because the
 * QueueProcessorService runs on a 30s background poll - the browser never
 * shows the transition, only its result.
 */
test.describe('Minew queue execution', () => {
  test('executes a scheduled queue against the label', async ({ page }) => {
    test.skip(!productId, 'create step did not yield a product id');

    await login(page);
    const token = await authToken(page);

    const api = async (path: string, init: RequestInit = {}) => {
      const res = await page.request.fetch(`${API_URL}${path}`, {
        method: (init.method as any) || 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: init.body ? JSON.parse(init.body as string) : undefined,
      });
      return res;
    };

    // Resolve the device + its store from the assignment we just created.
    const assignmentsRes = await api(
      `/device/assignments/paged?PageNumber=1&PageSize=50&LocationType=Product&LocationId=${productId}`,
    );
    expect(
      assignmentsRes.ok(),
      `could not read assignments: ${assignmentsRes.status()}`,
    ).toBeTruthy();

    const assignments = await assignmentsRes.json();
    const items =
      assignments?.result?.items || assignments?.items || [];
    const templateRow = items.find((a: any) => a.assignmentType === 'TEMPLATE');
    const messageRow = items.find((a: any) => a.assignmentType === 'MESSAGE');

    expect(templateRow, 'TEMPLATE assignment exists for the product').toBeTruthy();
    expect(messageRow, 'MESSAGE assignment exists for the product').toBeTruthy();

    // ProcessPendingQueues compares StartDate against DateTime.UtcNow, so the
    // start must be expressed in UTC and already elapsed to fire immediately.
    const startDate = new Date(Date.now() - 60_000).toISOString();
    const endDate = new Date(Date.now() + 60 * 60_000).toISOString();

    // Queue creation 409s when a still-active queue for the same device +
    // template overlaps the requested window - correct behaviour, but earlier
    // runs of this spec leave exactly such a queue behind (its window is an
    // hour long). Retire only the ones this spec created; a real user's queue
    // is never touched, and already-retired rows are left as history.
    const listRes = await api(
      '/queue?pageNumber=1&pageSize=100&sortBy=createdDate&sortDescending=true',
    );
    if (listRes.ok()) {
      const queues = (await listRes.json())?.result?.items ?? [];
      const mine = queues.filter(
        (q: any) => /^E2E Minew /.test(q.productName || '') && q.isActive,
      );
      for (const q of mine) {
        await api(`/queue/${q.id}`, { method: 'DELETE' });
      }
      if (mine.length) {
        console.log(`cleared ${mine.length} leftover E2E queue(s)`);
      }
    }

    const userId = await page.evaluate(() => {
      const raw =
        localStorage.getItem('currentUser') || localStorage.getItem('user');
      try {
        return raw ? JSON.parse(raw)?.id ?? 0 : 0;
      } catch {
        return 0;
      }
    });

    const createRes = await api('/queue/direct', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: templateRow.deviceId,
        templateId: templateRow.templateId,
        messageId: messageRow.messageId,
        locationType: 'PRODUCT',
        locationId: productId,
        storeId: templateRow.storeId,
        startDate,
        endDate,
        isRecurring: false,
        userId,
      }),
    });

    expect(
      createRes.ok(),
      `queue create failed: ${createRes.status()} ${await createRes.text().catch(() => '')}`,
    ).toBeTruthy();

    // A global middleware in Startup.cs forces ContentLength=0 on every 201,
    // so the create response has no body - the id only survives in Location.
    const location = createRes.headers()['location'] || '';
    const fromBody = await createRes
      .json()
      .then((b: any) => b?.result?.id ?? b?.id)
      .catch(() => undefined);

    const queueId = fromBody ?? Number(location.match(/\/queue\/(\d+)/)?.[1]);
    expect(
      queueId,
      `queue id from body or Location (location="${location}")`,
    ).toBeTruthy();

    // Status comes back as a name ("Pending" / "Completed" / "Failed"), not the
    // numeric StatusId used in the database.
    const readQueue = async () => {
      const res = await api(`/queue/${queueId}`);
      if (!res.ok()) return null;
      const body = await res.json();
      return body?.result ?? body;
    };

    // The processor polls every 30s; give it a few cycles before failing.
    await expect
      .poll(async () => (await readQueue())?.status ?? 'unknown', {
        message: 'queue reaches a terminal state',
        timeout: 4 * 60 * 1000,
        intervals: [10_000],
      })
      .toBe('Completed');

    const row = await readQueue();

    expect(row?.errorMessage ?? null, 'queue ran without error').toBeNull();
    // Completed with no BindingData would mean the Minew call never happened -
    // ActivateQueueAsync marks Completed before ExecuteQueueContent runs.
    expect(
      row?.bindingData,
      'queue recorded the Minew bind response',
    ).toBeTruthy();

    // The queue must carry BOTH the template and the message image; before the
    // ExecuteMinewQueue fix the image was dropped and only the template shipped.
    expect(row?.templateId, 'queue carries the template').toBeTruthy();
    expect(row?.messageId, 'queue carries the message').toBeTruthy();
    expect(row?.contentData, 'queue carries the message image data').toBeTruthy();

    // --- Deactivation retires the queue instead of reverting it to Pending ---
    //
    // Reverting to Pending meant (a) the queue kept blocking new ones for the
    // same device+template, (b) ProcessPendingQueues re-activated it within
    // 30s so deactivation never stuck, and (c) it dropped out of the completed
    // statistic. ProcessEndingQueues calls this same method when a window
    // closes, so this covers the natural-end path too.
    const deactivated = await api(`/queue/${queueId}/deactivate`, {
      method: 'POST',
      body: '{}',
    });
    expect(
      deactivated.ok(),
      `deactivate failed: ${deactivated.status()}`,
    ).toBeTruthy();

    const retired = await readQueue();
    expect(retired?.status, 'a queue that ran stays Completed').toBe('Completed');
    expect(retired?.isActive, 'a retired queue is no longer active').toBe(false);

    // It must stay retired - the old behaviour flipped it back on at the next
    // 30s poll because its window was still open.
    await page.waitForTimeout(45_000);
    const afterPoll = await readQueue();
    expect(
      afterPoll?.isActive,
      'the processor does not resurrect a deactivated queue',
    ).toBe(false);
    expect(afterPoll?.status, 'and it is still Completed').toBe('Completed');

    // And the freed window accepts a new queue rather than 409-ing.
    const replacement = await api('/queue/direct', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: templateRow.deviceId,
        templateId: templateRow.templateId,
        messageId: messageRow.messageId,
        locationType: 'PRODUCT',
        locationId: productId,
        storeId: templateRow.storeId,
        startDate,
        endDate,
        isRecurring: false,
        userId,
      }),
    });
    expect(
      replacement.ok(),
      `a retired queue must not block its window: ${replacement.status()} ${await replacement.text().catch(() => '')}`,
    ).toBeTruthy();

    // Don't leave the replacement occupying the window for the next run.
    const replacementId = Number(
      (replacement.headers()['location'] || '').match(/\/queue\/(\d+)/)?.[1],
    );
    if (replacementId) await api(`/queue/${replacementId}`, { method: 'DELETE' });
  });
});
