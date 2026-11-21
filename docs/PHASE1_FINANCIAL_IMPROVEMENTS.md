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

# Phase 1 financial and customer improvements

Implemented 2026-11-20 in the existing architecture, all four authorized branches; Sham Shaban remains disabled. This supersedes the branch-fixed record-currency statements in the earlier operations/expense documentation. Branch currency remains the legacy default and unit of its existing offline limit; every newly entered transaction, priced catalog record and expense may independently choose AFN or USD. No exchange conversion exists.

## Workflows

- Customer registration and new transactions default to today, and Jalali pickers include an explicit Today action using Asia/Kabul midnight. Existing historical reservation dates remain allowed. Same-day order/payment selections do not require a backdate grant; other-day order/payment overrides retain authorization. Rental return ordering, occupancy and payment rules remain.
- The reusable CurrencySelect has English, Dari and Pashto labels. Transaction choice applies to agreed price, discount, charges, advance and package totals. Catalog records retain their own price currency, including an independent original-price snapshot on transactions. Packages must use the transaction currency; mixed packages fail before any write. Choosing another currency removes package choices, without converting or changing the agreed amount.
- Payments, reversals and transaction corrections keep the original transaction currency. A disabled selector communicates this constraint. Payment API currency is optional for old callers but must match when supplied. Amounts still use strict integer minor units and exact arithmetic.
- Customer tables expose AFN and USD accounts. Legacy scalar totalMinor/paidMinor remain available for the explicitly labelled query/default currency and never combine currencies. Details retain per-currency balances. Tables, transaction/payment history and invoices format the actual record currency with consistent codes.
- Branch dashboards and financial reports provide a currency selector. Company branch cards show both accounts, and company charts aggregate only matching currencies across branches. Daily collection series, expense totals, CSV/XML exports and printed report titles retain their selected currency. Expenses retain their existing separate ledger; no unsupported net-profit/allocation workflow was added.
- Customer filters have responsive search/type/status/balance, sort/reset and date controls in one surface. Clear resets filters, sort and page. Existing safe query parsing and server-side branch/own-record predicates remain.
- Print bill appears before customer ID. It reuses InvoicePrintButton, authorized transaction reads and the existing current-version invoice snapshots/templates, including A4 paired copies/A5. The bill belongs to the row's latest authorized transaction; account history remains the way to choose an older bill. Rows with no authorized transaction cannot issue a bill. List print excludes the action column.

## Compatibility and migration

Build, then run `node scripts/database/migrate-currency.mjs` with the existing private backend environment. The migration is explicit, transactional and rerunnable, with no new indexes. It fills missing currencies on catalog/transaction/expense records using verified historical branch conventions: Dollar USD, the other active branches AFN. Missing payment currency is copied from its own branch-scoped parent transaction; an orphan aborts the transaction. Existing currencies, values, identifiers, customer records, credentials and historical invoice snapshots are preserved. There is no destructive reset or duplicate ledger.

Old callers may omit currency and receive the historical branch/default behavior. Transactions and payments keep immutable currencies. Changing catalog currency affects future prices only. Offline provisional transactions and payments retain their chosen currency. The existing single offline payment threshold is denominated in the branch configuration currency, so a different-currency offline advance/payment is denied rather than compared against the wrong unit. Offline transactions with no advance may use either currency.

## Scope and validation

The repository has no standalone salary/payroll or independent supplier-purchase ledger; this change covers every existing monetary workflow without adding unrelated modules. Existing clothing purchase/rental flows are included. No dependency/lockfile change. Physical printing and native-language owner acceptance remain separate from automated tests. Executed results, migration and launcher evidence: [project status](PROJECT_STATUS.md).
