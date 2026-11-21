# Whole-system reliability review - 2026-11-20

Fresh source check PASS: `npm run check`, 66 tests/nine files, strict TypeScript and ESLint, shared/backend/frontend production builds, disabled-branch/structure and PWA artifacts (52 precache entries). Targeted database/offline regression PASS 31/31. Read-only local existing-data API review PASS 118/118 across all four branches and role boundaries, without invoking the seeder or changing business/account records. Final operational browser acceptance PASS 14/14 in 2.5 minutes; authenticated browser acceptance PASS 21/21 in 2.0 minutes; format check PASS. Successful browser suites used guarded disposable databases and completed teardown. Initial interrupted/stale-selector attempts are documented at the top of PROJECT_STATUS.md along with exact fixes and normal launcher readiness. Existing physical-printer/device and production operations requirements remain separate.

# Phase 1 delivered: normal application ready - 2026-11-20

Normal launcher Start exited 0 and reported System is ready after the final full source check. Independently verified backend /api/v1/ready HTTP 200 and normal http://127.0.0.1:5173/login HTTP 200. The updated normal application and existing MongoDB are intentionally running for the owner. Final npm run check PASS (49/49 tests, types/lint/build/structure/PWA), operational browser PASS 10/10, focused currency/filter/printing PASS 1/1, authenticated browser PASS 19/19, npm run format:check PASS. Additive local currency metadata migration applied successfully; historical amounts, real credentials and invoice snapshots preserved. No Phase 2 implementation. Exact next task: owner acceptance of the finished Dari flows and physical A4/A5 printing; pre-existing production limitations remain documented.

# Phase 1 final source acceptance - 2026-11-20

Final `npm run check` PASS after all runtime and test changes: 49 tests in six files; strict workspace TypeScript, ESLint, shared/backend/frontend builds, structure/disabled-branch boundary and PWA artifact validation (44 precache entries). Operational browser suite PASS 10/10; focused expanded scenario PASS 1/1; authenticated suite PASS 19/19 after the documented test-contract updates. These are local automated results, not physical-printer/native-language acceptance. Existing upstream Zod annotation, bundle-size and test-runner color warnings remain non-fatal. No new dependency or lockfile change.

The additive local currency metadata migration completed with exit 0 and preserved historical amounts/snapshots. Source and documented module coverage: customers/transactions, catalog/inventory prices/packages, expenses, payments/reversals, accounts, branch/company dashboards, financial reports/exports, offline currency handling and individual invoice printing. No standalone payroll or independent supplier ledger exists in this repository; no unrelated module or Sham Shaban operation was added. Normal launcher restoration/readiness is recorded next. Exact next task: owner acceptance of the finished Dari workflows and physical A4/A5 printing with their printer.

# Phase 1 authenticated browser acceptance - 2026-11-20

Authenticated browser suite PASS 19/19 in 1.7 minutes against disposable fixtures, covering all three roles/login/logout, account assignment/revocation, branch messages, existing invoice sharing/list print, dashboard loading/error states, themes/RTL/navigation/modal containment, report downloads and public/login regressions. Initial run: 17 passed, 2 test-contract failures. The dashboard failure matcher assumed no query string, so it did not intercept the new currency-filtered route; updated it to match the URL pathname and retained loading/failure assertions. The preference test assumed Clear kept the sort; it now asserts the requested default sort reset, selects a new sort, and verifies that preference survives reload. No auth/error-handling bypass was added. Final complete rerun passed all 19. Normal source validation/launcher restoration follows below.

# Phase 1 browser acceptance - 2026-11-20

Full operational browser suite PASS 10/10 in 1.6 minutes on guarded disposable databases. Covers existing transactions/payments, paired A4/A5 and long invoice continuations, all languages/mobile, offline replay/conflict, branch dashboards and the new all-four-branch AFN/USD/today/row-print scenario. Strengthened focused rerun PASS 1/1 in 46.4 seconds (scenario 38.4s): combined search/type/status/today/sort/direction filters and reset; actual USD expense creation; catalog currency control; report currency switch; exact transaction/customer/currency association for each printed row; date survives refresh; RTL mobile containment. No browser page errors were recorded in the new scenario. Visually inspected customer-filters-phase1-rtl.png at 390px. Initial browser runner refused the occupied normal app port; verified launcher Stop freed its owned servers and preserved MongoDB. Final source/auth checks, metadata migration and normal launcher restoration follow below.

# Consolidated completion verification - 2026-11-18 (Asia/Kabul)

Fresh `npm run check` passed: strict types, lint, 45 tests/six files, shared/backend/frontend builds and structure/PWA checks (36 precache entries). Fresh Edge authentication/interface suite passed 13/13 (2.1 minutes); fresh business/printing/offline suite passed 7/7 (1.5 minutes), completed 2026-11-19 after an overnight execution pause during build. `npm run format:check` passed before final evidence updates. Initial sandbox esbuild spawn EPERM was resolved by running the same complete check outside the sandbox after the existing isolated MongoDB helper reported readiness. Tests use their guarded disposable databases; this review did not reset owner accounts or modify customer records. Upstream annotation/chunk-size and wrapper Node shell-deprecation warnings remain non-fatal. Final format/normal-build results are recorded at the top of PROJECT_STATUS.md. Existing historical evidence below does not establish fresh physical-device, printer, provider or production acceptance.

# Operations completion verification - 2026-11-18 (Asia/Kabul)

Implemented four active branch cards with database names/configurable naming, fixed branch currencies (Dollar USD; existing branches AFN), separated company financial totals/charts, grouped sidebar navigation and central return. Admin login opens the central dashboard while preserving the existing Royal branch default. Sham Shaban remains disabled. No reference dashboard image was available in the attached text, so the existing premium design system was reused.

Implemented atomic customer/initial transaction/item/advance registration, safe retry IDs and atomic offline queuing, customer address/account summaries and row navigation, paginated/filterable transaction history with expandable items/payments/invoices, direct account payment/edit/print controls, scoped audit history, payment references/currency, per-payment receipts and audited pending/ready transaction price/discount/charge/date/note corrections. Backend rejects totals below payments and reservation conflicts. Corrected cancelled-order customer-list totals, notification delivery dates and Kabul-day overdue counts. All existing physical clothing inventory and immutable historical invoice conventions are preserved.

Printing defaults to two identical landscape halves on A4 portrait, waits for fonts/images and invokes the browser print dialog. Long copies pair matching continuation pages with invoice/page numbers and cutting guide. Ordinary and long PDFs were generated. PDF metadata: A5 one page ~148.17 x 209.89 mm; ordinary paired/distinct A4 one page ~209.89 x 297.01 mm; long 20-item, long Dari name/notes, USD 1,002,100 fixture four A4 sheets with matching copies. All text bounds are inside their pages. Rendered pages were visually inspected at 1.5x. Browser/renderer geometry does not establish physical printer acceptance. The automated print call is observed via a test spy so a native dialog cannot block the runner.

See PROJECT_STATUS.md for complete test results, migration evidence and limitations.

---

# Premium interface validation - 2026-11-13

Final source check passed: strict TypeScript, ESLint, 40 tests/six files, production builds and source/PWA artifact checks. Edge auth/UI acceptance passed 11/11 in 55.9 seconds after final refinements. It verifies real chart values, all roles and prior account/offline/message/sharing flows, sidebar persistence/profile controls, 14 feature routes at 390/1440 widths, all three languages at 320/390/768/1280/1440, mobile drawer keyboard/inert controls, account dialog, reduced motion and loading/error separation from zero statistics. Manager made no global dashboard/notification requests. Final mobile/desktop Dari, login, employee and mobile-account screenshots were visually inspected. Single-day chart point and the associated Recharts selector failures were corrected before the passing run. Final business print/offline regression passed 6/6 in 37.5 seconds after updating the legacy navigation-label selector. Final test-file lint and format checks passed. Live startup is recorded in PROJECT_STATUS.md.

Final Master Prompt 03 evidence: Edge auth 9/9 (34.8s); business regression 6/6 (26.1s); launcher START exit 0, backend ready/frontend HTTP 200; seven actual owner logins/scopes/logout passed and anonymous sessions denied. Application remains running at http://127.0.0.1:5173. Private initial handoff is Acount/LOGIN_DETAILS.txt. No credentials printed. Source checks: 40 tests and production builds passed. Remaining deployment limitations are documented in AUTHENTICATION.md.

# Master Prompt 03 validation ? 2026-11-13

Source/database: npm run check passed with 40 tests, strict types, lint, builds and source/PWA artifacts. Edge auth acceptance passed 9/9 (34.8s), including real account creation/status, scope, messages, WhatsApp link and signed offline reload/expiry. Seven private owner handoffs matched active database account hashes; no passwords were printed. Mobile login and settled employee screenshots inspected. Format check passed before final documentation update. Final business regression/startup and formatting evidence is at the top of PROJECT_STATUS.md. Earlier validation records below are historical.

# Current validation - 2026-11-13 (Asia/Kabul)

See PROJECT_STATUS.md for the full changed-file list and limitations. Final npm run format:check passed. Final source checks after the offline fix passed: npm run check, 22 tests in four files, strict types/lint/builds/structure/PWA. npm run test:e2e passed all five Edge scenarios (26.4 seconds), including real offline reload/replay and independent-device conflict review. The generated invoice and mobile screenshots were visually inspected; physical printing and native-language approval remain pending.

npm ls --depth=0 passed. Runtime audit has zero findings; full audit retains four low build-tool findings, with no moderate/high/critical findings. MongoDB 8.0.38 replica set is observed on isolated loopback 27018. No existing service data was touched. STOP ownership regression and launcher syntax passed. Final launch-from-stopped-database rerun passed: START exit 0, backend ready, frontend HTTP 200, browser-open command successful. Duplicate START correctly exited 1 while preserving the running system.

Failed attempts were used to find and fix: rapid-test rate limiting, TanStack offline pausing, generated-report lint inclusion, Windows Start-Process descendant waiting, and missing PowerShell exit-code handle retention. Windows bootstrap uses WaitForExit on a retained helper handle, allowing detached mongod to remain running. Earlier successful checks are not used to conceal later failures.

Hosted CI and production hosting have not been executed. Manual PWA installation, physical-device/printer and native-language acceptance remain outstanding. No zero-defect guarantee is made.

---

## Historical Phase 1 report - superseded where contradicted above

# Phase 1 validation report

Date: 2026-11-12, Asia/Kabul. All commands were run from this workspace on Windows 10. No hosted CI success is claimed.

## Passed checks

- npm installation/targeted updates and `npm ls --depth=0`: successful workspace resolution.
- `npm run check`: exit 0; shared/backend/frontend strict TypeScript, ESLint, Vitest (7 tests/3 files), production builds, source structure and PWA artifacts.
- `npm run smoke:frontend`: exit 0; production page, service worker, manifest and icons returned HTTP 200. Temporary preview stopped.
- Argon2: native hash/verify worked with a throwaway string; no identity/account data created.
- Launcher syntax parsed without errors. STOP integration test terminated the verified owned process and preserved a process whose creation identity did not match. Test processes were cleaned up.
- Runtime-only dependency audit: zero advisories.

## Expected failure / outstanding acceptance

Real launcher START built successfully, validated local configuration, probed unavailable MongoDB, and attempted only the configured existing local service. Windows could not open/start that service. It exited 1 with a useful message, leaving no application processes or process-state file. The MongoDB service is still stopped. Full browser auto-open/start/stop lifecycle against live MongoDB remains unverified.

Actual browser PWA installation/offline, native-language review and responsive visual QA remain pending. Generated assets and HTTP delivery do not establish offline browser acceptance. Business modules, authorization integration, synchronization and production operations are outside Phase 1.

## Dependency audit and warnings

Initial audit: 15 findings including 2 critical. Final full audit: 4 low findings, from deepmerge and its PWA build-chain propagation; 0 moderate/high/critical. No compatible upstream patch was available. See SECURITY_DOCUMENTATION.md. The audit command exits 1 because findings remain; it is not a clean full audit.

npm warns about unapproved esbuild/Argon2 lifecycle scripts; included runtime binaries worked without further script approval. Rollup removes malformed PURE-comment annotations in upstream Zod; builds succeed. Sandbox esbuild spawn/process-query restrictions required reruns outside the sandbox. Initial network/cache failures and resolved source/launcher errors are recorded in PROJECT_STATUS.md.

Final reruns: `npm run format:check` and `npm run lint` both exited 0. The final STOP ownership regression test also exited 0, preserving the mismatched-identity process and cleaning up test processes.

Final state: application servers and isolated development database remain running for the owner. No physical browser-window/PWA installation observation is claimed; the five automated Edge scenarios are the browser evidence.

## Expense module validation - 2026-11-13

npm run check passed with 25 tests in four files, all builds/type/lint/structure/PWA checks. Full Edge suite passed 6/6 in 30.8 seconds; new expense scenario creates isolated rows through the UI in all three active branches and checks six columns, exact AFN amount, spentBy, reload, Dari and mobile containment. Existing print/payment/offline/conflict regressions passed. Explicit additive migration applied locally; tests apply it twice to a disposable database. Invalid amount refinement initially threw and returned 500; a schema pipeline fixed validation to 422. The initial browser setup import was one directory too high and was corrected before the passing run. No real expense records were created during tests.

Final targeted expense browser check: PASS (1/1, 13.5 seconds). Explicitly selected 21 Aqrab 1405 through the Jalali picker in each active branch and verified the saved table date; branch isolation/reload and settled 390px Dari mobile layout passed. The mobile screenshot was visually inspected. An initial test label selector for Month timed out; using the observed accessible combobox role corrected the test. Runtime source was unchanged by that selector correction. npm run format:check passed.

Live expenses delivery verified: updated launcher START exited 0; backend readiness and frontend HTTP passed. GET expenses returned HTTP 200 with correct row branch scope for sham-royal, sham-aroos and sham-aroos-vip. Updated application and isolated database are left running. Final lint and format checks passed. Exact next task is owner acceptance of the six fields, Jalali date labels and permitted branch users; pre-existing production limitations remain unchanged.
