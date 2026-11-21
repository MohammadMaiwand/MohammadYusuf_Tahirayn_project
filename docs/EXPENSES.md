# Record currency and customer workflow update - 2026-11-20

[Phase 1 implementation](PHASE1_FINANCIAL_IMPROVEMENTS.md) supersedes earlier branch-fixed currency descriptions for individual financial records. All active branches can select AFN/USD for transactions, priced catalog entries and expenses. Payments/corrections inherit transaction currency. API input currency is optional for backward compatibility, strictly AFN/USD when present; payment mismatch returns currency_mismatch (422). List/report queries accept currency. Report responses retain the selected-currency shape plus currencyReports for separate accounts and expensesMinor for authorized expense totals. Customer list balances contain exact per-currency totals; scalar totals describe only the response currency. No numeric values are converted. Additive migration: scripts/database/migrate-currency.mjs. Current test and delivery evidence is in PROJECT_STATUS.md.

# Branch expenses

Implemented on 2026-11-13. The three active branches each have an Expenses navigation entry, entry form and their own filtered table. Sham Shaban remains disabled. The shared database uses one expenses collection with mandatory server-side branchId filtering; separate physical collections would bypass the established shared-schema architecture.

## Fields and behavior

ID is a server-generated EXP-UUID reference (with UUID _id); name, positive amount, expense date, spentBy and description are stored. Amounts use integer AFN minor units and reject zero, negatives, more than two decimals and overflow. expenseAt is stored as a UTC instant and displayed in the Persian calendar in Asia/Kabul using the existing Jalali picker. Name and spentBy are required (160 characters); description is optional (2000 characters). Table has exactly the six requested columns, search by name/ID/person and pagination. English, Dari and Pashto labels are included; mobile uses the existing horizontal table scroller.

Records are append-only in this scope: no edit/delete, cash-account posting, payment settlement or net-profit report change is introduced. Expenses are online-only and never written to the browser IndexedDB cache/outbox. Offline sync replay of expense.create is denied. Writes retain a stable operation ID for unchanged form retries and use existing device verification, transactional idempotency and audit machinery.

## Authorization and API

expenses.read and expenses.create apply to admin, manager and user role defaults, limited to active branch memberships. Existing per-user deny overrides remain effective. GET /api/v1/branches/:branchId/expenses accepts bounded page/limit/q and returns {data:{items,total,page,limit}} with Cache-Control:no-store. Sort is expense date descending, UUID tie-breaker. POST /api/v1/branches/:branchId/commands accepts action expense.create and strict data {name,amount,expenseAt,spentBy,description}, operationId and deviceId. A caller cannot supply branchId in expense data. Anonymous, ungranted, disabled-branch and permission-denied operations fail server-side. No accounts or login interface are created.

## Additive migration and deployment order

Reviewed migration source: backend/src/database/expensesMigration.ts. Model autoCreate/autoIndex are disabled and Expense is intentionally absent from startup allModels; the new collection and indexes are created only by this explicit migration. It creates expenses with unique {branchId,code}, {branchId,updatedAt,_id} and {branchId,expenseAt,_id} indexes and adds permission metadata to the three existing role definitions. No existing business record/index is removed or rewritten. It is idempotent; integration setup runs it twice to check reruns.

1. Build shared/backend with npm run build.
2. Apply node scripts/database/migrate-expenses.mjs using the configured backend environment. The script never prints credentials and disconnects on completion/failure.
3. Restart application servers to load the new contracts, routes and role defaults.

Tests run the migration against unique guarded temporary databases. The browser global setup applies it only to a myt_ui_test_<32 hex> database. Actual results and local migration/restart evidence are in PROJECT_STATUS.md. Production deployment retains the pre-existing identity, backup and security acceptance requirements.

Final targeted expense browser check: PASS (1/1, 13.5 seconds). Explicitly selected 21 Aqrab 1405 through the Jalali picker in each active branch and verified the saved table date; branch isolation/reload and settled 390px Dari mobile layout passed. The mobile screenshot was visually inspected. An initial test label selector for Month timed out; using the observed accessible combobox role corrected the test. Runtime source was unchanged by that selector correction. npm run format:check passed.

Live expenses delivery verified: updated launcher START exited 0; backend readiness and frontend HTTP passed. GET expenses returned HTTP 200 with correct row branch scope for sham-royal, sham-aroos and sham-aroos-vip. Updated application and isolated database are left running. Final lint and format checks passed. Exact next task is owner acceptance of the six fields, Jalali date labels and permitted branch users; pre-existing production limitations remain unchanged.
