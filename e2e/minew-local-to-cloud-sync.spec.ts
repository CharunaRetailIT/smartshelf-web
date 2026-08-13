import { expect, test } from '@playwright/test';
import { fetchStores, login, setDefaultStore } from './fixtures';

/**
 * Device Management -> Sync -> "Create Locally then Sync to Minew".
 *
 * That option used to be a stub: a 2s timer and a success toast, with no HTTP
 * call at all. The point of this spec is that the click now actually reaches
 * devices/batch-add-minew (which fronts Minew's apis/esl/label/batchAdd) and
 * that the toast reflects what the cloud really said.
 *
 * Talks to the real Minew cloud. Labels already registered there come back as
 * "already added", which is a valid outcome rather than a failure.
 */
test('pushes local devices to Minew from the sync dialog', async ({ page }) => {
  await login(page, { seedStore: false });

  // Needs a store that is linked to Minew, otherwise the guard short-circuits.
  const stores = await fetchStores(page);
  const store = stores.find((s: any) => s.minewStoreId);
  test.skip(!store, 'no store is synced to Minew yet');
  await setDefaultStore(page, store);

  await page.goto('/device-management');

  // Toolbar "Sync" on the Devices tab.
  await page.getByRole('button', { name: /^Sync$/i }).first().click();

  const syncDialog = page.locator('.mat-mdc-dialog-container').last();
  await expect(syncDialog).toBeVisible();
  // localToCloud is the default direction.
  await expect(syncDialog).toContainText(/Create Locally then Sync to Minew/i);

  // Two steps, both labelled "Start Sync": the dialog's own action opens a
  // confirmation dialog, whose confirm button actually runs the sync.
  await syncDialog.getByRole('button', { name: /Start Sync/i }).click();

  const confirm = page.locator('.mat-mdc-dialog-container').last();
  await expect(confirm).toBeVisible();

  const pushed = page.waitForResponse(
    (r) =>
      r.url().includes('/device/devices/batch-add-minew') &&
      r.request().method() === 'POST',
    { timeout: 180_000 },
  );

  await confirm.getByRole('button', { name: /Start Sync/i }).click();

  // This is the regression guard: the stub never issued a request.
  const res = await pushed;
  expect(res.status(), 'batch-add-minew should be called and succeed').toBeLessThan(400);

  const body = await res.json().catch(() => ({}));
  const results: Record<string, string> = body?.result?.results ?? {};
  expect(
    Object.keys(results).length,
    'Minew should answer for at least one MAC',
  ).toBeGreaterThan(0);

  // Every verdict must be understood: added, already present, or an explicit
  // reason. Anything else means the payload shape changed.
  for (const [mac, verdict] of Object.entries(results)) {
    expect(verdict, `no verdict for ${mac}`).toBeTruthy();
  }

  // And the UI must report it rather than claiming blanket success.
  await expect(page.locator('.p-toast-message').first()).toContainText(
    /Sync to Minew:/i,
    { timeout: 30_000 },
  );
});
