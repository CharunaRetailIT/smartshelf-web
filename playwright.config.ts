import { defineConfig, devices } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Loads e2e/.env (gitignored) so credentials live in a local file instead of
 * the shell history or the repo. Existing env vars always win, so CI can
 * override without touching the file.
 */
function loadEnvFile(): void {
  const envPath = resolve(__dirname, 'e2e/.env');
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvFile();

/**
 * These specs drive a REAL Minew ESL label through the real Minew cloud.
 * They create real rows (product, combos, assignments, queue) in whatever
 * database the API points at - never run them against production.
 *
 * Required env vars (see e2e/README.md):
 *   E2E_EMPLOYEE_ID, E2E_PASSWORD
 * Optional overrides:
 *   E2E_BASE_URL, E2E_API_URL, E2E_DEVICE_MAC, E2E_TEMPLATE, E2E_MESSAGE
 */
export default defineConfig({
  testDir: './e2e',
  // The hardware flow is inherently sequential - one label, one bind at a time.
  fullyParallel: false,
  workers: 1,
  // Retrying a bind that already reached the label would double-push it.
  retries: 0,
  // Binds and cloud syncs are slow; the queue spec waits on a 30s poll loop.
  timeout: 5 * 60 * 1000,
  expect: { timeout: 30 * 1000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env['E2E_BASE_URL'] || 'http://localhost:4200',
    // The API uses a self-signed dev cert on :44321.
    ignoreHTTPSErrors: true,
    actionTimeout: 30 * 1000,
    navigationTimeout: 60 * 1000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
