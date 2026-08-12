# Minew ESL end-to-end tests

These specs drive a **real physical ESL label** through the **real Minew cloud**.
They create real rows (product, combos, assignments, queue) in whatever database
the API is pointed at, and they physically re-render the label on your desk.

**Never run these against production.**

## Hardware under test

Defaults match the single label currently available; override via env if that changes.

| Env var | Default | What it is |
|---|---|---|
| `E2E_DEVICE_MAC` | `e0000000be65` | The label's MAC / device name |
| `E2E_TEMPLATE` | `Dynamic-4.2` | Minew cloud template |
| `E2E_MESSAGE` | `Apple New` | Message whose image gets bound |
| `E2E_BRAND` | `Minew ESL` | ESL brand as shown in the dropdown |

## Setup

Both the Angular dev server (`:4200`) and the API (`:44321`) must already be running.

```bash
npx playwright install chromium
```

Credentials are read from the environment so nothing secret lands in the repo:

```bash
export E2E_EMPLOYEE_ID='your-employee-id'
export E2E_PASSWORD='your-password'
```

Optional overrides: `E2E_BASE_URL` (default `http://localhost:4200`),
`E2E_API_URL` (default `https://localhost:44321/api`).

## Running

Full lifecycle — create product, attach ESL, sync, bind, and queue:

```bash
npm run e2e
```

Watch it happen in a real browser:

```bash
npm run e2e:headed
```

Pick and step through individual specs:

```bash
npm run e2e:ui
```

## What each spec covers

`minew-esl-lifecycle.spec.ts` (runs serially, shares the created product):

1. **creates a product with a Minew ESL assignment** — fills Product Details,
   switches to the ESL tab, picks brand → device → template → message. Asserts
   the save request succeeded and captures the new product id.
2. **persists both TEMPLATE and MESSAGE assignment rows** — reopens the product
   in edit mode. The form merges the two `DeviceAssignment` rows back into one
   UI row by device, so an empty template or message field here means one of the
   rows was lost on save.
3. **syncs products to the Minew cloud** — asserts the sync POST succeeds.
4. **binds product data from the product form** — clicks Quick Bind (no message)
   and asserts `bind-unified` returned OK.
5. **binds together with the message image** — clicks Bind with Message and
   asserts the response reports `hasImage`, which is the only way to tell from
   outside that the image actually rode along.

`minew-esl-lifecycle.spec.ts` (queue block) — creates a `BIND` queue whose
`startDate` is already elapsed, then polls the API until the background
`QueueProcessorService` moves it to Completed (status `7`). It also asserts
`bindingData` is non-empty, since a queue can report Completed without the Minew
call having produced anything.

> The processor polls every **30 seconds** and starts with a 10s delay, so this
> test legitimately takes a couple of minutes. Timeouts are set accordingly.

`minew-shelf-assignment.spec.ts` — aisle → shelf → assign product, then binds
from the assignment page's Devices tab. It picks up the newest `E2E Minew ...`
product automatically, so it can run straight after the lifecycle spec. Pin a
specific one with `E2E_PRODUCT_NAME` if you prefer. Re-running is safe: a
product that's already on the shelf is treated as success rather than a
failure.

## Known sharp edges

- **Store selection is seeded, not chosen.** The app keeps the active store in
  `localStorage` and every list endpoint is scoped by it; a fresh browser
  profile has none, which makes category/device/template dropdowns come back
  empty. `login()` seeds it, defaulting to the store with the most devices.
  Override with `E2E_STORE_ID`.
- **UTC vs local time.** `ProcessPendingQueues` compares `StartDate` against
  `DateTime.UtcNow`. The queue spec sends an explicit UTC ISO string. If you
  schedule through the UI instead and it sends local time, a queue can sit
  Pending for hours — worth checking separately.
- **Icon-only buttons have no accessible name.** Several actions (shelf
  "Assign Products", "Quick Bind") carry their meaning in `title`/`pTooltip`
  only, so the specs match those attributes rather than `getByRole(...,
  { name })`. Adding `aria-label` to those buttons would improve both
  accessibility and test readability.
- **Selectors are structural.** These pages have no test ids, so the specs lean
  on PrimeNG element names and visible text. If that markup is reworked, they
  break loudly rather than silently passing.
- **Ended queues go back to Pending, not a terminal state.** When a queue's
  window closes, `ProcessEndingQueues` calls `DeactivateQueueAsync`, which sets
  the status back to `Pending` and leaves `IsActive = true`. The duplicate check
  on queue creation skips only `Completed`/`Failed`, so a finished run keeps
  409-ing new queues for the same device + template until its window expires.
  The queue spec deletes its own leftovers (products named `E2E Minew ...`)
  before creating, which is what makes it re-runnable.
- **No product cleanup.** Each run leaves a product named `E2E Minew <timestamp>`
  behind so you can inspect what the label was told to show. Delete them
  periodically.
