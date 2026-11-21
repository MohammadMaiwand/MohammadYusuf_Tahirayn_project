# Whole-system reliability review - 2026-11-20

Owner requested a complete review of existing workflows after confirming registration was fixed. Reviewed the actual customer/transaction/payment/report/offline paths and ran database/browser regressions. Fixed the following reproducible defects:

- Customer and transaction upcoming filters now use the Kabul calendar-day window used by dashboard counts, including today's midnight reservations and excluding day seven.
- Outstanding filters exclude cancelled orders even when the cancelled status filter is also selected. Branch and own-record scope are retained.
- Branch report transaction matching preserves requested status/upcoming filters while independently excluding cancelled orders; the cancellation rule no longer overwrites the selected status.
- A server-committed mutation remains successful if its optional browser cache write fails. It emits a storage warning rather than falling through to another provisional write or reporting sync-disabled after success.
- Offline payment drafts reject cancelled transactions before queue/cache writes. Offline transaction snapshots retain original catalog currency and the selected expected-return date.
- Excessive package totals show amount validation and disable Save rather than throwing during render and closing the registration screen. The user can correct the quantity in place.
- Browser acceptance explicitly pins its built API URL to the isolated loopback fixture and enables the tested sync configuration. A local production-mode tunnel setting previously redirected the test browser away from its database/server. Production environment files remain untouched.

No dependency, API payload/response shape, schema, index, migration, owner account or existing business record change. Sham Shaban stays disabled. Tests and final readiness: PROJECT_STATUS.md. Physical printing/device acceptance and production hosting/backups remain separate from local verification.

# Customer reservation conflict correction - 2026-11-20

Fixed the shared occupancy predicate used by availability, atomic customer registration, transaction creation and date corrections. An undelivered rental with no expected return now reserves its selected Kabul calendar day instead of an infinite interval. A same-day return also occupies at least that day, avoiding empty intervals. Longer explicit rentals keep their existing exclusive return boundary. Active purchases, overlapping bookings and overdue/unreturned physical deliveries remain unavailable; branch filters and concurrent product locking are preserved.

This supersedes the previous open-ended interpretation for omitted return dates in response to the owner's repeated registration blocker. Historical stored dates, customer/payment/invoice records and credentials are untouched. No API shape, schema, index, migration or dependency change. Regression coverage exercises today behind a future reservation, an actual conflict followed by a successful changed-date registration, same-day returns, availability parity, cross-branch denial and unreturned deliveries in a disposable database.

# Branch availability and expected return date - 2026-11-20

GET /branches/:branchId/products/:id/availability?reservationAt&type&returnDueAt, the customer.register/transaction.create validation and transaction.update now compare the expected return against the reservation by Kabul calendar day (via the shared calendarDay offset already used by garment alterations), instead of by exact instant. A same-day or later returnDueAt is accepted; a returnDueAt earlier than the reservation day still returns 422 invalid_return_date. Omitting returnDueAt keeps the rental open-ended as before. No route, payload field, response shape, index or schema changed.

# Advertisement management and public banners - 2026-11-20

Management routes require `advertisements.manage`. Admins list/manage company-wide and branch ads. Managers list/manage only ads tagged to their assigned branch; the server derives branch scope from the verified session. Employees remain denied. GET /advertisements lists up to 200 records in the caller's scope; POST /advertisements creates (admin-created records are company-wide, manager-created records belong to the manager's branch); PATCH /advertisements/:id and DELETE /advertisements/:id enforce the same scope; POST /advertisements/photos accepts `{data:base64}` up to ~7 MB and returns `{photoId}`. The strict `advertisementInput` schema (title, optional body/linkUrl/linkLabel, photoId, active, order, startsAt/endsAt) rejects unknown fields; an end before start returns `invalid_advertisement_dates` (422) and an unknown or out-of-scope photo returns `invalid_advertisement_photo` (422).

Public (no authentication, mounted before the identity middleware at /api/v1/public): GET /public/advertisements returns active, in-window records (max 20, ordered) from all scopes with Cache-Control public, max-age=30; GET /public/advertisements/:id/image returns a referenced WebP blob with Cache-Control public, max-age=86400, immutable and `Cross-Origin-Resource-Policy: cross-origin` so separate frontend/API origins can render it. Only images still referenced by an ad are served. Responses use `{data}`; errors use `{error:{message,requestId}}` as elsewhere.

# Phase 2 garment alteration integration - 2026-11-20

[Garment alterations](GARMENT_ALTERATIONS.md) documents the new branch-scoped ledger/model, shared strict commands, list/detail/tailor/receipt/photo endpoints, permission defaults and overrides, separate per-currency booked service charges, localized print surface and durable management-only reminders. Additive explicit migration: scripts/database/migrate-alterations.mjs. Existing records, payments, original purchase prices, invoices and credential handoff remain preserved. Actual executed tests and delivery readiness are in PROJECT_STATUS.md.

# Record currency and customer workflow update - 2026-11-20

[Phase 1 implementation](PHASE1_FINANCIAL_IMPROVEMENTS.md) supersedes earlier branch-fixed currency descriptions for individual financial records. All active branches can select AFN/USD for transactions, priced catalog entries and expenses. Payments/corrections inherit transaction currency. API input currency is optional for backward compatibility, strictly AFN/USD when present; payment mismatch returns currency_mismatch (422). List/report queries accept currency. Report responses retain the selected-currency shape plus currencyReports for separate accounts and expensesMinor for authorized expense totals. Customer list balances contain exact per-currency totals; scalar totals describe only the response currency. No numeric values are converted. Additive migration: scripts/database/migrate-currency.mjs. Current test and delivery evidence is in PROJECT_STATUS.md.

# Master Prompt 03 API additions ? current

All routes use /api/v1. Public GET /auth/captcha supports image and accessible modes. POST /auth/login validates role, branch, normalized employee name/email, password and one-time CAPTCHA. POST /auth/refresh rotates cookies; POST /auth/logout revokes; authenticated GET /auth/me, POST /auth/password and POST /auth/logout-all support self-service. GET/POST /users, PATCH /users/:id (expectedVersion), POST /users/:id/password implement lifecycle, assignment and reset without public registration. GET /roles, /permissions, /sessions; DELETE /sessions/:id; GET /security/audit enforce role, ownership and permission checks.

GET /notifications/global and POST /notifications/:id/read are admin-scoped. GET/POST /branches/:branchId/messages and POST /branches/:branchId/messages/:id/read persist isolated branch messages. Existing /session, /branches, branch business routes and /dashboard/comparison now use cookie sessions; development fixtures remain explicitly opt-in and loopback only. Mutating cookie/auth requests require x-myt-request: 1; browser requests include credentials. Responses use {data}; safe errors use {error:{message,requestId}}. No secrets are returned in account/session lists. See [AUTHENTICATION.md](AUTHENTICATION.md); earlier no-login statements below are superseded.

## Company report - 2026-11-20

GET /api/v1/reports/company (admin only, reports.read) returns `{ generatedAt, branches:[{branchId,name}], comparison:[{branchId,branchName,currency,customers,newCustomers,products,transactions,purchases,rentals,agreedMinor,paidMinor,collectedMinor,outstandingMinor,upcomingCount,overdueCount,expensesMinor,alterationChargesMinor}], summary:[{currency,customers,products,newCustomers,upcomingCount,overdueCount,collectedMinor,expensesMinor,alterationChargesMinor,totals:{count,purchases,rentals,agreedMinor,paidMinor,outstandingMinor},byDay,status,popularity}] }` for every active branch the admin can access, aggregated per AFN/USD. GET /api/v1/reports/company/export?format=csv|excel (admin only, reports.read + exports.read) returns the comparison table plus one `TOTAL (currency)` row per currency as CSV or Excel-compatible XML. These routes live on the top-level router (not under /branches/:branchId); non-admins receive 403 forbidden. They are distinct from the branch-scoped GET /branches/:branchId/reports and /reports/export, which are unchanged.

# Current implementation ? 2026-11-13 (Asia/Kabul)

Implemented API: public GET /api/v1/health and /ready; verified-identity GET /session, /branches, /permissions (users.manage), /dashboard/comparison. All business paths below use /api/v1/branches/:branchId and active membership checks.

GET /dashboard, /reports, /reports/export?format=csv|excel (Excel-compatible XML), /settings, /users; GET /customers/:id, /transactions/:id, /invoices/:id; GET /:resource and catalog /:resource/:id. POST /commands accepts the shared strict command schema with operationId/deviceId, action, data and optional resource/targetId/expectedVersion. POST /:resource and PATCH /:resource/:id are convenience adapters. POST /sync/push and GET /sync/pull require enabled server sync and permissions. See backend/src/routes/business.ts and shared/schemas/business.ts for exact allowlists. No login or token-issuance endpoint exists.

Response data uses {data:...}; errors use {error:{message,requestId}}. Rate limits now return HTTP 429 with rate_limited and Retry-After. RATE_LIMIT_MAX defaults to 120 per minute/IP; browser-test servers explicitly use 2000. Input validation errors use 422. Commands enforce device registration, permissions, branch filters, expected versions and idempotency.

---

## Historical Phase 1 record ? superseded where contradicted above

# API v1

| Method | Route          | Response                                                                         | Authentication |
| ------ | -------------- | -------------------------------------------------------------------------------- | -------------- |
| GET    | /api/v1/health | 200 `{status:"ok",phase:1}`; process liveness                                    | Public         |
| GET    | /api/v1/ready  | 200 `{status:"ready"}` or 503 `{status:"unavailable"}` based on Mongo connection | Public         |

Unknown routes return 404; malformed JSON returns 400; unexpected failures return a generic 500. Error envelope: `{error:{message,requestId}}`. No login, token issuance, refresh, business, sync, or branch-operation endpoints exist. `/health` does not imply database readiness. Startup refuses to listen when MongoDB cannot connect.

`verifyAccessToken` is infrastructure only: HS256 allowlist, issuer/audience, required exp/iat/sub, and branchIds claim validation. Missing configuration fails closed. It is not attached to public health routes. Future access tokens need short lifetimes, revocation/refresh policy and server-side membership freshness before commercial use. Never trust a frontend branch header without verified grants.

## Expenses addition - 2026-11-13

New GET /api/v1/branches/:branchId/expenses and expense.create command are implemented with read/create permissions, branch membership, positive AFN amount validation, idempotency and no-store list responses. See EXPENSES.md.

## Operations completion - 2026-11-18

The fourth active branch is `dollar` with currency `USD`; existing branches remain `AFN`. Sham Shaban is denied. Existing `POST /api/v1/branches/:branchId/commands` now accepts `customer.register` with `{customer, transaction}` (transaction omits customerId), and `transaction.update` with targetId and `{expectedVersion, agreedPrice, discount?, charges?, reservationAt, notes}`. Registration checks both customer and transaction permissions plus payment permission when an advance is positive. The entire command, audit and idempotency result commit atomically. Transaction correction requires `transactions.update`, current ownership/branch access, pending/ready status, an available reservation, and a positive total at least equal to payments received. It is online-only.

Transaction creation accepts optional decimal-string `discount` and `charges`, both default zero. Payments accept optional `reference` (100 characters); currency is copied from the related transaction, never trusted from the request. GET customer detail adds `balances`, grouped by currency. GET reports/dashboard adds `currency`. GET audit-logs accepts a customerId only after checking that customer in the active branch, and filters to that customer's scoped customer/transaction/payment records. GET settings includes `branchName`; settings.update optionally renames the database branch and rejects currency changes. No existing endpoint or identifier is removed.

Invoice receipt selection is a frontend query parameter `payment` on an already authorized invoice preview; it cannot expand server-side access. A receipt is printable only when the selected payment is actually present in that immutable snapshot. Print actions add `autoprint=1`; browsers still control their own dialog and printer preferences. See OPERATIONS_COMPLETION.md for migration and limitations.
