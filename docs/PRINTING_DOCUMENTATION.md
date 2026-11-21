# Phase 2 garment alteration integration - 2026-11-20

[Garment alterations](GARMENT_ALTERATIONS.md) documents the new branch-scoped ledger/model, shared strict commands, list/detail/tailor/receipt/photo endpoints, permission defaults and overrides, separate per-currency booked service charges, localized print surface and durable management-only reminders. Additive explicit migration: scripts/database/migrate-alterations.mjs. Existing records, payments, original purchase prices, invoices and credential handoff remain preserved. Actual executed tests and delivery readiness are in PROJECT_STATUS.md.

# Record currency and customer workflow update - 2026-11-20

[Phase 1 implementation](PHASE1_FINANCIAL_IMPROVEMENTS.md) supersedes earlier branch-fixed currency descriptions for individual financial records. All active branches can select AFN/USD for transactions, priced catalog entries and expenses. Payments/corrections inherit transaction currency. API input currency is optional for backward compatibility, strictly AFN/USD when present; payment mismatch returns currency_mismatch (422). List/report queries accept currency. Report responses retain the selected-currency shape plus currencyReports for separate accounts and expensesMinor for authorized expense totals. Customer list balances contain exact per-currency totals; scalar totals describe only the response currency. No numeric values are converted. Additive migration: scripts/database/migrate-currency.mjs. Current test and delivery evidence is in PROJECT_STATUS.md.

# Current implementation ? 2026-11-13 (Asia/Kabul)

Implemented InvoicePaper, PrintPage and print.css: immutable server invoice snapshots, A5 invoice preview, two distinct rotated A5 invoices on one A4 sheet, localized totals/dates and permission-protected reads. Browser tests generate .local/print-validation/invoice-a5.pdf, invoices-a4.pdf and screenshots and check dimensions/overflow. This establishes browser layout only; physical printer margins, long invoices, font coverage and owner approval remain unverified.

---

## Historical Phase 1 record ? superseded where contradicted above

# Printing requirements — planned

Only the printing component folder is scaffolded. No invoices, financial documents, print templates or print routes exist. Future requirements: A4 and receipt layouts, Dari/Pashto RTL and English LTR, embedded licensed local fonts, repeated table headings, clean page breaks, branch identity, immutable approved invoice snapshots, currency-specific totals and Afghanistan Solar Hijri dates. Test PDF output, physical printers and multi-page documents. Printing authorization must use the same server-side branch checks as data reads.

## Operations completion - 2026-11-18

See [operations completion](OPERATIONS_COMPLETION.md) for current implementation, additive migration, currency rules, atomic registration, account history, transaction corrections, paired continuation printing and explicit limitations. This supersedes the older three-active-branch/AFN-only/print-default descriptions. Verification is recorded in PROJECT_STATUS.md.
