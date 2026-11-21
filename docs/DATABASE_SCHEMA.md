# Advertisements - 2026-11-20

Two additive collections support both company-wide admin banners and branch-owned manager banners. `advertisements` stores `_id` (uuid), nullable `branchId` (null means company-wide), title (<=160, required), body (<=2000), linkUrl (<=500), linkLabel (<=60), nullable `photoId`, active, order (0..100000), nullable startsAt/endsAt, createdBy and timestamps. Indexes support the public `{active:1, order:1, createdAt:-1}` sort and manager `{branchId:1, order:1, createdAt:-1}` scope. `advertisementImages` stores `_id` (uuid), nullable owner `branchId`, immutable processed WebP Buffer, createdBy and timestamps. Explicit rerunnable migration: `backend/src/database/advertisementsMigration.ts` via `scripts/database/migrate-advertisements.mjs`; it backfills missing branch metadata as null, creates indexes and synchronizes the manager default permission while preserving existing advertisement records and images. No startup auto-index change.

# Phase 2 garment alteration integration - 2026-11-20

[Garment alterations](GARMENT_ALTERATIONS.md) documents the new branch-scoped ledger/model, shared strict commands, list/detail/tailor/receipt/photo endpoints, permission defaults and overrides, separate per-currency booked service charges, localized print surface and durable management-only reminders. Additive explicit migration: scripts/database/migrate-alterations.mjs. Existing records, payments, original purchase prices, invoices and credential handoff remain preserved. Actual executed tests and delivery readiness are in PROJECT_STATUS.md.

# Record currency and customer workflow update - 2026-11-20

[Phase 1 implementation](PHASE1_FINANCIAL_IMPROVEMENTS.md) supersedes earlier branch-fixed currency descriptions for individual financial records. All active branches can select AFN/USD for transactions, priced catalog entries and expenses. Payments/corrections inherit transaction currency. API input currency is optional for backward compatibility, strictly AFN/USD when present; payment mismatch returns currency_mismatch (422). List/report queries accept currency. Report responses retain the selected-currency shape plus currencyReports for separate accounts and expensesMinor for authorized expense totals. Customer list balances contain exact per-currency totals; scalar totals describe only the response currency. No numeric values are converted. Additive migration: scripts/database/migrate-currency.mjs. Current test and delivery evidence is in PROJECT_STATUS.md.

# Master Prompt 03 database changes

The existing users collection is extended, not duplicated: normalizedEmail (partial unique index), passwordHash (excluded by default), accountStatus, assignedBranchId, createdBy/updatedBy, lastLoginAt, failedLogins/lockedUntil and grantVersion. Admin branchIds covers the three active branches and assignedBranchId is null. Manager/employee scope is one active branch. UserSession stores access/refresh digests, access expiry, absolute expiry, revocation and device/IP metadata. refreshTokens stores digest-to-session history for reuse detection. captchaChallenges and loginAttempts have TTL indexes. securityAuditLogs stores safe activity metadata; branchMessages stores branch scope and per-user read state.

backend/src/database/authMigration.ts is the explicit rerunnable migration: normalize legacy role user, deactivate legacy accounts lacking status, add unique email/auth indexes and replace only the obsolete reminder uniqueness index. It does not erase customers, payments, invoices or branch data. scripts/database/setup-accounts.mjs restricts initial owner setup to the isolated development database, preserves existing accounts and saves new handoffs under ignored Acount. See [AUTHENTICATION.md](AUTHENTICATION.md). Older no-account claims below are historical.

# Current implementation ? 2026-11-13 (Asia/Kabul)

Registered models now exist in backend/src/database/models.ts: products, productCategories, guarantees, packageItems, customers, transactions, payments, invoices, branchSettings, notifications, auditLogs, syncOperations, devices, users, roles, permissions and branches. Inspect model declarations for fields and compound indexes. Business records carry branchId, code, createdBy, timestamps and version. Transactions snapshot products/packages/guarantees; payments reference transactions; invoices preserve immutable snapshots; sync operations uniquely bind actor/branch/operation IDs to request hashes.

Startup currently creates collections/indexes, three active branches, role/permission definitions, branch settings and guarantee types. It creates no default user accounts and never seeds Sham Shaban. MongoDB must be a replica set or mongos because financial commands use transactions. Production bootstrap still creates indexes explicitly; reviewed migration tooling remains required before deployment (autoIndex:false alone does not solve this).

Local development uses .local/mongodb/data on loopback 27018, replica set myt-dev. Tests use unique myt_test_* or myt_ui_test_* databases with guarded cleanup. Existing service data is preserved.

---

## Historical Phase 1 record ? superseded where contradicted above

# Database schema and isolation

Implemented: Mongoose connection lifecycle and an unregistered branch schema factory. **No business collections, models, seed data, users, accounts, or migrations are created.** Sham Shaban has no database record.

Future business documents require immutable `branchId`, an active-branch enum, timestamps, and `{branchId:1,_id:1}` / `{branchId:1,createdAt:-1}` compound indexes. Module-specific uniqueness must include branchId (for example invoice number per branch); no invoice schema exists yet. Production index changes must use reviewed migrations, not automatic index creation. Auto-indexing is disabled in production.

Planned collections: users (identity and grants), branches (only three active records when explicitly approved), products, guarantees, packages, customers, transactions, payments, notifications, reports if materialization is justified, audit events, sync operations. These names are proposals, not registered models. Relationships between business records must verify both IDs and matching branchId. User membership is server managed; user-submitted membership must never be trusted.

All future reads, writes, deletes, counts, aggregates, bulk operations, exports, print endpoints, jobs, and sync operations require server-side branch authorization and branch filters. Never spread user query objects into Mongo filters; allowlist fields. Include branch scope inside transaction predicates. Cross-branch reporting needs a separately authorized operation. Tests must attempt cross-branch object IDs and writes. Shared-database isolation is an application responsibility, not MongoDB row-level security.

## Expenses addition - 2026-11-13

Expense is an additive branch-scoped model with explicit migration (excluded from startup bootstrap). See EXPENSES.md for fields, indexes and safe deployment order.

## Operations completion - 2026-11-18

See [operations completion](OPERATIONS_COMPLETION.md) for current implementation, additive migration, currency rules, atomic registration, account history, transaction corrections, paired continuation printing and explicit limitations. This supersedes the older three-active-branch/AFN-only/print-default descriptions. Verification is recorded in PROJECT_STATUS.md.
