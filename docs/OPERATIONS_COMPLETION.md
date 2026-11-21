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

# Phase 2 garment alteration integration - 2026-11-20

[Garment alterations](GARMENT_ALTERATIONS.md) documents the new branch-scoped ledger/model, shared strict commands, list/detail/tailor/receipt/photo endpoints, permission defaults and overrides, separate per-currency booked service charges, localized print surface and durable management-only reminders. Additive explicit migration: scripts/database/migrate-alterations.mjs. Existing records, payments, original purchase prices, invoices and credential handoff remain preserved. Actual executed tests and delivery readiness are in PROJECT_STATUS.md.

# Record currency and customer workflow update - 2026-11-20

[Phase 1 implementation](PHASE1_FINANCIAL_IMPROVEMENTS.md) supersedes earlier branch-fixed currency descriptions for individual financial records. All active branches can select AFN/USD for transactions, priced catalog entries and expenses. Payments/corrections inherit transaction currency. API input currency is optional for backward compatibility, strictly AFN/USD when present; payment mismatch returns currency_mismatch (422). List/report queries accept currency. Report responses retain the selected-currency shape plus currencyReports for separate accounts and expensesMinor for authorized expense totals. Customer list balances contain exact per-currency totals; scalar totals describe only the response currency. No numeric values are converted. Additive migration: scripts/database/migrate-currency.mjs. Current test and delivery evidence is in PROJECT_STATUS.md.

# Unified new-customer registration - 2026-11-19

Replaced the two-step customer/initial-transaction UI with one modal containing the existing editable customer fields and complete transaction controls. The shared form applies to all four active branches and every existing entry point using CustomerForm. Existing-customer editing and add-transaction workflows remain available. Callers without transaction creation permission retain the permitted customer-only form; permissions are not bypassed.

The form shows generated reference information, product/type, prices/discount/charges/packages, initial payment/method, reservation/return/order dates, guarantee, notes, calculated total/paid/balance/days and initial delivery state. Reference IDs and financial/day/state summaries remain system-generated, not arbitrary editable values. Optional business fields retain their existing optional validation. Customer details remain editable until final submission. Existing atomic customer.register command, branch isolation, offline queue and server authorization are reused. Retry hashes now include customer details so edits cannot reuse the prior request payload identity. No backend API/schema, migration or dependency changes.

Browser regressions now fill customer and transaction details without Continue to transaction; added all-four-branch immediate-field/cancel/mobile coverage. Final verification results follow in PROJECT_STATUS.md. Next task: owner acceptance of the unified Dari form and catalog configuration in each branch. Earlier two-step descriptions are superseded by this record.

# Operations completion - 2026-11-18 (Asia/Kabul)

Completion review: the local workflows described below are implemented, but this does not mean every production or business extension is finished. The consolidated current checklist is at the top of [TASK_TRACKER.md](TASK_TRACKER.md); fresh executed verification belongs in PROJECT_STATUS.md. External messaging, partial delivery/product replacement, automated refunds/allocation and production backup/restore remain absent as described below. This review does not send customer messages, reset accounts or change business records.

Implemented against the existing React/Express/Mongoose stack without new dependencies. Four operational branches are Dollar Department (USD), Sham Royal, Sham Aroos and Sham Aroos VIP (AFN). Sham Shaban remains disabled. The supplied message did not include the referenced dashboard image, so cards reuse the existing design system.

## Changes

- Database branch names drive central dashboard cards and shell navigation; branch settings can rename a branch. Currency is fixed by branch to prevent relabelling existing balances. Company totals/charts are separated by currency.
- Sidebar has expandable operational and management groups. Existing account permissions remain grouped by module and scoped by the account's assigned branch; transactions.update is available to administrators/managers and explicitly delegable.
- New customer entry stages details locally, then saves customer, physical product snapshot, optional multiple package-item lines and advance in one MongoDB transaction. The customer is not persisted at the first step. Existing customers retain the add-transaction workflow. Phone numbers are not made globally unique.
- Registration uses existing command idempotency, duplicate retry identifiers and atomic offline queue storage. Sync rechecks membership, permissions, inventory conflicts and offline payment limits. Offline data is provisional until accepted by the server.
- Customer rows support mouse/keyboard account navigation without hijacking interactive controls. Accounts include details/address, exact per-currency summaries, paginated/searchable transactions, outstanding filter, expandable item/payment/invoice history, direct payment/edit/print actions and permission-protected audit history.
- Transaction edits change agreed price, discount, charges, delivery date and notes for pending/ready orders only. Product/package replacements remain intentionally outside this correction form because they require a new inventory reservation. Totals below collected payments are rejected. Cancellation still requires recorded payment reversals first. Existing immutable invoice snapshots remain historical; printing issues the current transaction version.
- All money uses integer minor units and BigInt intermediates; at most two decimal places are accepted, with no implicit rounding. Final total = agreed physical item price + package quantities times snapshot prices - discount + charges. Quantities for the existing tracked physical clothing item remain one; package lines support multiple integer quantities. No separate customer tables are created.
- Payments retain installments and immutable reversals. Each payment has a printable, identified receipt from the account or transaction history, using an authorized immutable invoice snapshot. Payment reference/currency metadata is persisted. Transactions serialize concurrent payments via shared document writes and expected version; retrying the same command returns its recorded result.
- Print defaults to two identical landscape halves on A4 portrait, with a center cutting guide, practical internal margins, font/image readiness and print-dialog invocation from Print bill. Long invoices pair page N of each copy on the same sheet, with invoice/page numbers. Single A5 and distinct-invoice modes remain available.
- Notifications use the transaction delivery date. Existing reminder reconciliation suppresses completed/cancelled/rescheduled reminders. Dashboard overdue counts use Kabul calendar-day boundaries. There is no automatic messaging provider in this repository; the UI explicitly reports in-app-only reminders and no sent customer messages. No provider credentials or customer sending was added.

## Safe migration and setup

Build with `npm run build`, then run `node scripts/database/migrate-operations.mjs` using the existing private backend/.env configuration. A MongoDB replica set is required. The rerunnable transactional migration adds the Dollar branch/settings, adds Dollar membership to existing administrators, updates permission metadata, and backfills missing payment currency from the matching branch-scoped transaction. It preserves IDs, passwords, customer records, prices and balances. An orphan payment causes rollback for manual review. New fields default safely; historical invoice snapshots are untouched. Restart the application after migration. Assign Dollar managers/employees through existing account management; no default account or credential is created.

No messaging configuration is required for in-app reminders. Automatic external delivery remains unavailable until an actual provider, delivery-attempt ledger and transport are implemented. Existing WhatsApp links require user review and manual sending.

## Acceptance limits

Existing workflow tracks delivery of one physical clothing item plus accessories as an order; independent partial quantities are not supported. No automatic refund/allocation across transactions is introduced. Price/date correction does not rewrite delivered or cancelled orders. Browser settings must use A4 portrait, 100% scale and disabled browser headers/footers for paired output; an application cannot override all printer settings. Physical printer/native-language/device acceptance remains necessary. Current test outcomes are recorded in PROJECT_STATUS.md; no production-readiness claim is made.
