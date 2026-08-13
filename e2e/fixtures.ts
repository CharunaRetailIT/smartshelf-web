import { expect, Page } from '@playwright/test';

/**
 * The single physical label available for testing. Override via env if the
 * hardware on hand changes - nothing here is hardcoded into the specs.
 */
export const HW = {
  deviceMac: process.env['E2E_DEVICE_MAC'] || 'e0000000be65',
  /**
   * What to type into the device dropdown's filter. It must match the device's
   * NAME, because PrimeNG's client-side filter only looks at optionLabel -
   * typing the full MAC hides every row even though the API found it.
   * Device names follow "Minew Device <last 6 of MAC>".
   */
  get deviceSearch(): string {
    return (
      process.env['E2E_DEVICE_SEARCH'] ||
      (process.env['E2E_DEVICE_MAC'] || 'e0000000be65').slice(-6)
    );
  },
  template: process.env['E2E_TEMPLATE'] || 'Dynamic-4.2',
  message: process.env['E2E_MESSAGE'] || 'Apple New',
  brand: process.env['E2E_BRAND'] || 'Minew ESL',
};

export const API_URL =
  process.env['E2E_API_URL'] || 'https://localhost:44321/api';

/**
 * Credentials come from the environment so no secret ever lands in the repo.
 * Failing loudly here beats a confusing timeout on the login form.
 */
export function credentials(): { employeeId: string; password: string } {
  const employeeId = process.env['E2E_EMPLOYEE_ID'];
  const password = process.env['E2E_PASSWORD'];

  if (!employeeId || !password) {
    throw new Error(
      'Set E2E_EMPLOYEE_ID and E2E_PASSWORD before running these specs. See e2e/README.md.',
    );
  }
  return { employeeId, password };
}

/** A per-run suffix so repeated runs never collide on product code. */
export function runId(): string {
  return `${Date.now().toString().slice(-8)}`;
}

/**
 * `seedStore: false` skips the default-store seeding for specs that run against
 * an empty StoreMaster - provisioning creates the first store itself, and
 * ensureDefaultStore throws when there is nothing to pick.
 */
export async function login(
  page: Page,
  opts: { seedStore?: boolean } = {},
): Promise<void> {
  const { employeeId, password } = credentials();

  await page.goto('/auth');

  await page.locator('input[formcontrolname="employeeId"]').fill(employeeId);
  await page.locator('input[formcontrolname="password"]').fill(password);
  // "Sign In" also labels the sign-in/sign-up toggle, so target the form's
  // submit button specifically.
  await page.locator('form button[type="submit"]').click();

  // AuthGuard redirects to the dashboard once the token is stored.
  await page.waitForURL(/\/dashboard/, { timeout: 60_000 });

  if (opts.seedStore !== false) await ensureDefaultStore(page);
}

/**
 * Points the app at a specific store, the way the Settings screen would.
 * Provisioning specs call this right after creating their store, since every
 * list endpoint is scoped by whatever sits in `defaultStore`.
 */
export async function setDefaultStore(page: Page, store: any): Promise<void> {
  await page.evaluate(
    (s) => localStorage.setItem('defaultStore', JSON.stringify(s)),
    store,
  );
  await page.reload();
}

/** Fetches the local StoreMaster list straight from the API. */
export async function fetchStores(page: Page): Promise<any[]> {
  const token = await authToken(page);
  const res = await page.request.fetch(
    `${API_URL}/Store?pageNumber=1&pageSize=50`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok()) throw new Error(`could not list stores: ${res.status()}`);
  const body = await res.json();
  return body?.result?.items ?? body?.items ?? body?.result ?? [];
}

/**
 * The app keeps the active store in localStorage and every list endpoint is
 * scoped by it. A fresh browser profile has none, so storeId falls back to 0
 * and category/device/template dropdowns all come back empty. Seed it the same
 * way the Settings screen would.
 */
export async function ensureDefaultStore(page: Page): Promise<void> {
  const already = await page.evaluate(() =>
    localStorage.getItem('defaultStore'),
  );
  if (already) return;

  const token = await authToken(page);
  // /Store is the local StoreMaster list. (/device/stores returns the Minew
  // cloud's own stores, whose ids are unrelated to local storeId.)
  const res = await page.request.fetch(
    `${API_URL}/Store?pageNumber=1&pageSize=50`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok()) throw new Error(`could not list stores: ${res.status()}`);

  const body = await res.json();
  const stores: any[] =
    body?.result?.items ?? body?.items ?? body?.result ?? [];
  const wanted = process.env['E2E_STORE_ID'];

  // Several stores exist but only one holds the devices/categories under test
  // (the others are empty demo rows). Without an explicit E2E_STORE_ID, pick
  // the store with the most registered devices - that's where the hardware is.
  const store = wanted
    ? stores.find((s: any) => String(s.id) === String(wanted))
    : [...stores]
        .filter((s: any) => s.isActive)
        .sort((a: any, b: any) => (b.deviceCount ?? 0) - (a.deviceCount ?? 0))[0];

  if (!store)
    throw new Error(
      `no stores available to set as default (got ${JSON.stringify(body).slice(0, 300)})`,
    );

  await page.evaluate(
    (s) => localStorage.setItem('defaultStore', JSON.stringify(s)),
    store,
  );

  // The store is read during component init, so reload to pick it up.
  await page.reload();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

/**
 * PrimeNG v19 renders p-dropdown through the newer Select component, so the
 * panel is `.p-select-overlay` and rows are `.p-select-option` - the older
 * `.p-dropdown-*` classes no longer appear in the DOM.
 */
export const OVERLAY = '.p-select-overlay';
export const OPTION = '.p-select-option, li[role="option"]:not(.p-select-empty-message)';

/**
 * PrimeNG dropdowns render their panel in an overlay appended to body, so the
 * option is not a child of the trigger. Filter first when the list is paged -
 * most of these dropdowns only hold the first 10 rows until searched.
 */
export async function selectFromDropdown(
  page: Page,
  trigger: ReturnType<Page['locator']>,
  optionText: string,
  opts: { filter?: boolean | string } = {},
): Promise<void> {
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();

  const panel = page.locator(OVERLAY).last();
  await panel.waitFor({ state: 'visible' });

  if (opts.filter) {
    // PrimeNG also filters client-side against optionLabel only, so the search
    // term has to appear in the label - not merely in the rendered row (a MAC
    // shown by an item template gets filtered out even when the server
    // returned it). Callers pass an explicit term when those differ.
    const term = typeof opts.filter === 'string' ? opts.filter : optionText;
    const filterInput = panel.locator('input.p-select-filter, input').first();
    await filterInput.fill(term);
    // Server-side filtered dropdowns debounce their search request.
    await page.waitForTimeout(1500);
  }

  const option = panel
    .locator(OPTION)
    .filter({ hasText: optionText })
    .first();

  await expect(option).toBeVisible({ timeout: 20_000 });
  await option.click();
  await panel.waitFor({ state: 'hidden' }).catch(() => void 0);
}

/** Reads a PrimeNG toast, used to assert bind/sync outcomes. */
export async function expectToast(
  page: Page,
  pattern: RegExp,
  timeout = 60_000,
): Promise<void> {
  await expect(
    page.locator('.p-toast-message').filter({ hasText: pattern }).first(),
  ).toBeVisible({ timeout });
}

/**
 * Grabs the bearer token the app stored at login so specs can assert against
 * the API directly (queue state) without re-implementing the login flow.
 */
export async function authToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => {
    for (const key of ['auth_token', 'token', 'access_token']) {
      const v = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (v) return v;
    }
    const match = document.cookie.match(/auth_token=([^;]+)/);
    return match ? match[1] : null;
  });

  if (!token) throw new Error('Could not read auth token after login');
  return token;
}
