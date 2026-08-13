import { expect, test } from '@playwright/test';
import {
  API_URL,
  authToken,
  fetchStores,
  login,
  runId,
  selectFromDropdown,
  setDefaultStore,
} from './fixtures';

/**
 * Provisioning flow against the REAL Minew cloud:
 *
 *   1. create a store locally
 *   2. sync that store up to Minew
 *   3. add two physical labels from the portal
 *   4. push those labels to Minew, into the store from step 1
 *
 * Assumes a freshly cleared SmartShelfDb (no stores, no devices) - it creates
 * the first store and seeds it as the app's default, so it does not depend on
 * anything pre-existing.
 *
 * These are real labels on a real gateway. Running this creates a real store
 * and real devices in the Minew cloud, which this spec does NOT clean up.
 */

const MACS = [
  process.env['E2E_MAC_1'] || 'e1000005e79d',
  process.env['E2E_MAC_2'] || 'e0000000f853',
];

const RUN = runId();
const STORE_NAME = process.env['E2E_STORE_NAME'] || `E2E Store ${RUN}`;
const STORE_CODE = `E2E${RUN}`;

/** Carried between the serial steps. */
let createdStore: any = null;

test.describe.serial('Minew store + device provisioning', () => {
  test('creates a store locally', async ({ page }) => {
    // StoreMaster is empty on a fresh DB, so there is no default store to seed.
    await login(page, { seedStore: false });

    // Minew caps how many stores a merchant may hold (error 54068 once the
    // quota is gone), and every run that creates one burns a slot permanently -
    // they cannot be deleted through this API, only deactivated. So reuse an
    // already-synced E2E store when one exists; set E2E_FORCE_NEW_STORE=1 to
    // deliberately create another.
    if (!process.env['E2E_FORCE_NEW_STORE']) {
      const existing = (await fetchStores(page)).find(
        (s: any) => s.storeName?.startsWith('E2E Store ') && s.minewStoreId,
      );
      if (existing) {
        createdStore = existing;
        await setDefaultStore(page, createdStore);
        test.info().annotations.push({
          type: 'note',
          description: `reusing synced store ${existing.storeName} (${existing.minewStoreId})`,
        });
        return;
      }
    }

    await page.goto('/store-management');

    await page.getByRole('button', { name: /Add Store/i }).click();

    const dialog = page.locator('.mat-mdc-dialog-container');
    await expect(dialog).toBeVisible();

    await dialog.locator('input[formcontrolname="storeName"]').fill(STORE_NAME);
    await dialog.locator('input[formcontrolname="storeCode"]').fill(STORE_CODE);

    // "Minew Cloud Store" is what makes the row eligible for the cloud sync in
    // the next step; a 'local' store is never pushed.
    await dialog.locator('input[formcontrolname="storeType"][value="minew"]').check();

    // Minew's store/add rejects a blank number, name or address (code 54029),
    // so a cloud store cannot sync without all three.
    await dialog
      .locator('textarea[formcontrolname="address"]')
      .fill(process.env['E2E_STORE_ADDRESS'] || 'Colombo, Sri Lanka');

    const created = page.waitForResponse(
      (r) =>
        r.url().includes('/Store') &&
        r.request().method() === 'POST' &&
        !r.url().includes('/sync'),
    );
    await dialog.getByRole('button', { name: /Create Store/i }).click();

    const res = await created;
    expect(res.status(), 'store create should succeed').toBeLessThan(400);

    // Read it back so later steps have the real local id.
    await expect
      .poll(async () => (await fetchStores(page)).some((s) => s.storeName === STORE_NAME), {
        timeout: 30_000,
      })
      .toBe(true);

    createdStore = (await fetchStores(page)).find((s) => s.storeName === STORE_NAME);
    expect(createdStore, 'created store should be readable from the API').toBeTruthy();

    // Every list endpoint is scoped by the active store, so point the app at it.
    await setDefaultStore(page, createdStore);
  });

  test('syncs the store up to the Minew cloud', async ({ page }) => {
    test.skip(!createdStore, 'store creation did not complete');
    test.skip(
      !!createdStore?.minewStoreId,
      'store already carries a MinewStoreId - nothing to push',
    );

    await login(page, { seedStore: false });
    await setDefaultStore(page, createdStore);

    await page.goto('/store-management');
    await page.getByRole('button', { name: /Sync Stores/i }).click();

    const dialog = page.locator('.mat-mdc-dialog-container');
    await expect(dialog).toBeVisible();

    // Push direction only - pulling would drag every pre-existing cloud store
    // back into the freshly cleared database.
    const toCloud = dialog.locator('input[formcontrolname="syncToCloud"]');
    if (!(await toCloud.isChecked())) await toCloud.check();

    const fromCloud = dialog.locator('input[formcontrolname="syncFromCloud"]');
    if (await fromCloud.isChecked()) await fromCloud.uncheck();

    const synced = page.waitForResponse(
      (r) => r.url().includes('/Store/sync') && r.request().method() === 'POST',
      { timeout: 120_000 },
    );
    await dialog.getByRole('button', { name: /^Sync|Start Sync/i }).last().click();

    const res = await synced;
    expect(res.status(), 'store sync should succeed').toBeLessThan(400);

    // The only proof the cloud accepted it is a MinewStoreId coming back.
    await expect
      .poll(
        async () => {
          const s = (await fetchStores(page)).find((x) => x.id === createdStore.id);
          return s?.minewStoreId ?? null;
        },
        { timeout: 120_000, message: 'store should come back with a MinewStoreId' },
      )
      .toBeTruthy();

    createdStore = (await fetchStores(page)).find((x) => x.id === createdStore.id);
  });

  test('adds both labels from the portal', async ({ page }) => {
    test.skip(!createdStore?.minewStoreId, 'store is not synced to Minew');

    await login(page, { seedStore: false });
    await setDefaultStore(page, createdStore);

    await page.goto('/device-management');

    for (const mac of MACS) {
      // The split button's main action is "Add Single Device".
      await page.getByRole('button', { name: /Add Device/i }).first().click();

      const dialog = page.locator('.mat-mdc-dialog-container');
      await expect(dialog).toBeVisible();

      await dialog
        .locator('input[formcontrolname="deviceName"]')
        .fill(`Minew Device ${mac.slice(-6)}`);
      await dialog.locator('input[formcontrolname="macAddress"]').fill(mac);

      await selectFromDropdown(
        page,
        dialog.locator('p-dropdown[formcontrolname="storeId"], p-select[formcontrolname="storeId"]'),
        createdStore.storeName,
        { filter: createdStore.storeName },
      );

      const saved = page.waitForResponse(
        (r) => r.url().includes('/device/device') && r.request().method() === 'POST',
      );
      await dialog.getByRole('button', { name: /Create Device/i }).click();

      const res = await saved;
      expect(res.status(), `creating ${mac} should succeed`).toBeLessThan(400);

      await expect(dialog).toBeHidden({ timeout: 30_000 });
    }

    // Both should now be listed locally.
    const token = await authToken(page);
    // GetLocalDevices takes no query parameters.
    const listed = await page.request.fetch(`${API_URL}/device/devices/local`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listed.ok(), 'local device list should be readable').toBe(true);
    const body = await listed.json();
    const macs = JSON.stringify(body).toLowerCase();
    for (const mac of MACS) expect(macs).toContain(mac.toLowerCase());
  });

  test('pushes both labels up to Minew, into the new store', async ({ page }) => {
    test.skip(!createdStore?.minewStoreId, 'store is not synced to Minew');

    await login(page, { seedStore: false });
    await setDefaultStore(page, createdStore);

    await page.goto('/device-management');

    // Batch Add is the only path that actually creates devices in the Minew
    // cloud - Device Management's "sync local to cloud" is a stub that shows a
    // success toast without calling anything.
    await page
      .locator(
        'p-splitbutton .p-splitbutton-menubutton, p-splitbutton .p-splitbutton-dropdown, p-splitbutton button',
      )
      .last()
      .click();
    await page
      .locator('.p-menuitem-link, [role="menuitem"]')
      .filter({ hasText: /Batch Add Minew/i })
      .first()
      .click();

    const dialog = page.locator('.mat-mdc-dialog-container');
    await expect(dialog).toBeVisible();

    // This dropdown lists the MINEW cloud's own stores, so it only contains the
    // store because step 2 pushed it up.
    await selectFromDropdown(
      page,
      dialog.locator('p-dropdown, p-select').first(),
      createdStore.storeName,
      { filter: createdStore.storeName },
    );

    await dialog.locator('textarea').first().fill(MACS.join('\n'));

    const added = page.waitForResponse(
      (r) =>
        r.url().includes('/device/devices/batch-add-minew') &&
        r.request().method() === 'POST',
      { timeout: 240_000 },
    );
    // executeImport() reads the textarea directly, so no preview step needed.
    await dialog.getByRole('button', { name: /Import Devices/i }).click();

    const res = await added;
    expect(res.status(), 'batch add to Minew should succeed').toBeLessThan(400);

    const payload = await res.json().catch(() => ({}));

    // Minew answers per MAC, in the account's own language. "成功"/"success"
    // means added; "标签已被添加" means the label is already registered in the
    // cloud (usually under another store) and has to be released there first.
    const results: Record<string, string> = payload?.result?.results ?? {};
    expect(Object.keys(results).length, 'Minew should answer for each MAC').toBe(
      MACS.length,
    );

    const accepted = (v: string) => /^(success|成功)$/i.test((v ?? '').trim());
    const alreadyThere = (v: string) => (v ?? '').includes('已被添加');

    for (const mac of MACS) {
      const verdict = results[mac] ?? results[mac.toLowerCase()];
      expect(verdict, `Minew should report on ${mac}`).toBeTruthy();
      // Already-registered is not a regression in this flow - re-running the
      // spec hits it for every label added by a previous run.
      expect(
        accepted(verdict) || alreadyThere(verdict),
        `${mac} was rejected by Minew: ${verdict}`,
      ).toBe(true);
    }

    // At least one label must have genuinely landed the first time through.
    expect(
      Object.values(results).some((v) => accepted(v) || alreadyThere(v)),
      'no label reached the Minew cloud',
    ).toBe(true);
  });
});
