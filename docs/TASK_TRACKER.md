# GitHub source publication - 2026-11-21

Validation for this publication: npm run check PASS (66/66 tests, types, lint, all builds, structure and PWA artifacts); npm run format:check PASS. First sandbox run hit esbuild EPERM; the first unrestricted run found the isolated MongoDB stopped and timed out before integration tests. Started the existing isolated replica set with npm run db:dev, preserving data, and the full rerun passed. Existing Zod annotation and bundle-size warnings remain. Hosted CI and browser acceptance were not rerun for this source-publication task. README formatting and a trailing space in the font license were normalized without changing their meaning.

Owner requested publication of the complete project to the configured GitHub origin on main. Source, lockfile, launcher, tests, documentation and supplied project references are included. Existing README history is preserved. Private Acount handoffs, real environment files, local databases, runtime logs, dependencies and generated builds remain ignored. No dependency, API, schema, migration, account or business-rule changes were made. Pre-publication checks confirmed the remote main baseline and no candidate files above 50 MiB or matches for common private-key/token/credential-bearing MongoDB URI patterns. Publication and final verification are recorded in the delivery response; this preparation entry does not claim a completed push. Next task: verify the remote commit after push and review hosted CI separately from local checks.

# Local login without internet - 2026-11-21

Fixed the normal local login pointing at an obsolete temporary Cloudflare API override. Restored the ignored frontend/.env.local API URL to loopback. frontend/src/lib/env.ts now routes development pages opened on localhost/127.0.0.1 through the existing same-origin Vite /api proxy, preventing a leftover tunnel override from breaking local CAPTCHA/login. Public tunnel hosts and production builds retain their explicitly configured API URL. The local backend and MongoDB must remain running; internet is unnecessary for local authentication. Existing signed-lease rules still apply when the backend itself is unavailable.

No dependency, schema, migration, password, grant or business-record change. Existing launcher-owned servers were restarted using the normal launcher; separate review hosting was untouched. Exact locked versions inspected: Vite 7.3.8 and Vitest 5.1.0. Required npm run check PASS: 66/66 tests, types, lint, builds, structure and PWA checks. Initial sandbox test attempt hit esbuild spawn EPERM; approved rerun passed. Existing upstream annotation/bundle warnings remain. Actual Edge verification blocked all external HTTP requests: admin/manager/employee CAPTCHA, login, dashboard, reload and logout PASS. No credentials printed. Next task: owner reloads the local login and confirms use with internet disconnected while the local launcher stays running.

# Customer review link - 2026-11-20

- [x] Research Render Free/Atlas Free; confirm account/browser access unavailable rather than inventing a deployment.
- [x] Prepare a clearly labelled temporary Cloudflare HTTPS preview with separate build, database, sample records and nine authenticated review-only accounts.
- [x] Seed verifier PASS 121/121; public 200 and anonymous private-API 401 checks passed.
- [ ] Complete real public browser/cookie/scope/logout checks and final handoff.
- [ ] Independent always-available cloud hosting: requires authenticated provider account access; not completed by this temporary tunnel.

# Whole-system reliability review - 2026-11-20

- [x] Review registration, payment, calendar/filter/report and offline paths; preserve branch scope and historical records.
- [x] Fix Kabul upcoming/cancelled debt/status-report filters, committed-write cache errors, offline cancelled-payment/snapshot parity and package-overflow rendering.
- [x] Add database/offline/browser regressions and isolate browser fixture configuration from production tunnel settings.
- [x] Final full source check PASS 66/66; operational browser PASS 14/14; authentication browser PASS 21/21; format check PASS; read-only existing-data API review PASS 118/118.
- [x] Normal launcher START successful; backend/frontend HTTP 200; existing database preserved. Next: owner acceptance of filters/offline/registration with actual garments/customers and physical-printer/device testing.

# Reservation correction - 2026-11-20

- [x] Replace infinite optional-return occupancy with selected Kabul day; retain actual conflicts and physical-delivery protection.
- [x] Add atomic registration/date retry/availability/branch-isolation regression coverage.
- [x] Full check PASS (62/62 tests); format check PASS; normal launcher restarted, backend/frontend HTTP 200. Next: owner acceptance with actual garment/customer.

# Three-language localization pass - 2026-11-20

- [x] Branch labels (topbar selector/chip, notifications, dashboard header, company report, public branch cards) now resolve through `branchLabel`, preferring the translation over the database name.
- [x] Public landing page fully localized from `i18n/publicSite.ts` with its own language switcher and RTL/LTR direction.
- [x] Hardcoded brand text in the login screen and topbar replaced with localized `app.company`/`app.name`; topbar uses the short name to avoid header overflow.
- [x] Print-mode selector clears prepared sheets only on a real change (removes a flaky invoice-preview expectation).
- [x] `npm run typecheck`, `npm run check` and `npm run format:check` PASS; operational `test:e2e` 13/13 and authenticated `test:auth:e2e` 21/21 recorded from the working environment.
- [ ] Owner live check of the language switch on the public page, branch selector and dashboard in all three languages.

# Whole-system test pass - 2026-11-20

- [x] Full source check `npm run check` PASS (61 tests in eight files; strict workspace TypeScript, ESLint, shared/backend/frontend builds, structure and PWA with 52 precache entries).
- [x] `npm run format:check` PASS.
- [x] Operational browser acceptance `npm run test:e2e` PASS 13/13; authenticated browser acceptance `npm run test:auth:e2e` PASS 21/21 (guarded disposable databases).
- [x] Branch seeder/verifier `node scripts/database/seed-demo.mjs` PASS 121/121 checks across all four active branches and admin/manager/employee/anonymous boundaries.
- [x] Corrected the stale "Dollar Department" notification-table expectation to the reminder's own branch (Sham Royal).
- [x] Corrected the superseded manager advertisement 403 expectation to the authorized branch-scoped 200, with explicit manager foreign-branch and employee denial checks.
- [x] Normal launcher restarted: backend `/api/v1/ready` 200, frontend 200, public banners 200 with a cross-origin `image/webp` banner response.
- [ ] Owner review of the public banner rendering and the manager branch's advertisement screen with real data.

# Advertisement image rendering and manager controls - 2026-11-20

- [x] Override Helmet's same-origin resource policy only for public banner images; verify image bytes and browser natural size.
- [x] Add manager advertisement CRUD/image/scheduling controls while filtering every management operation to the manager's assigned active branch.
- [x] Keep company-wide administration with admin; deny employees and cross-branch manager access.
- [x] Add nullable branch ownership and its manager-scope index via the existing explicit rerunnable migration; preserve old company-wide records.
- [x] Verify backend image/branch authorization integration tests and manager UI browser acceptance.
- [x] `npm run check`, `npm run format:check`, local migration, normal launcher restart and public image rendering.
- [ ] Owner review the public image and manager branch's advertisement list after signing in again (the new role grant appears after a fresh session).

# Advertisements module and responsiveness pass - 2026-11-20

Implemented the owner's follow-up request. Admin advertisements module (create/edit/delete, photo upload, title/body, optional link + label, active toggle, order, Jalali schedule window) under the new advertisements.manage permission; the public site root before login dynamically shows active, in-window banners via unauthenticated GET /api/v1/public/advertisements, with lazy images and HTTP caching. Images are processed with sharp and stored as immutable blobs; no disk writes, no CDN. Responsiveness: React Query staleTime 60s/gcTime 5 minutes/window-focus refetch with one retry, session identity re-check every 30s, shared reportShared resolution in reports, and public cache headers. Additive migration scripts/database/migrate-advertisements.mjs. Existing customer/transaction/invoice/alteration/credential records preserved; no startup index change; no new dependency.

npm run check PASS: 57 tests in seven files, strict workspace TypeScript and ESLint, shared/backend/frontend builds, structure/disabled-branch boundary and PWA (50 precache entries); npm run format:check PASS. Exact next task: owner review of real banners on the public page plus native-language/visual acceptance and normal launcher start; production hosting/backup/index migration remains distinct.

# Phase 2 garment alterations - 2026-11-20

Implemented the authorized alteration module across all four active branches, customer accounts and transaction details. See [Garment alterations](GARMENT_ALTERATIONS.md) for the shared form/table/receipt, immutable original price/currency, separate service-charge reporting, granular authorization, online-only data handling, additive migration and durable management reminders using Kabul calendar days. Existing customer/transaction/invoice/credential records are preserved; no operational Sham Shaban or exchange conversion was introduced.

Final npm run check PASS: 57 tests in seven files, strict workspace TypeScript and ESLint, shared/backend/frontend builds, structure/disabled-branch boundary and PWA (47 precache entries); npm run format:check PASS. Full operational+alteration browser acceptance PASS 12/12 on two consecutive runs against guarded disposable databases (two alteration scenarios plus the ten existing operations scenarios, covering all four branches, both currencies, receipts, reminder scheduling/deduplication, RTL/LTR and mobile). Acceptance surfaced and fixed one integration regression: the embedded alteration section reused the generic .stats-grid class, duplicating it beside the transaction/customer summary, so the module dashboard summary is now rendered only in the standalone Garment Alterations module while the embedded tabs keep the records list, filters and form. The additive rerunnable local migration node scripts/database/migrate-alterations.mjs executed with exit 0 and preserved existing customer/transaction/invoice/credential records. Exact next task: owner native-language and physical-printer acceptance plus normal launcher start; production hosting/backup/index migration remains distinct.

# Phase 1 completed locally - 2026-11-20

- [x] Today/Kabul date registration and persistence, preserving genuine backdate/occupancy rules.
- [x] Per-record AFN/USD in every existing monetary workflow and all four authorized branches.
- [x] Separate customer/branch/company/report totals, daily series, expenses and currency-aware printing/exports.
- [x] Responsive customer filters, combined search/date/type/status/sort and full reset/pagination.
- [x] Authorized per-row current bill action before customer ID.
- [x] Additive metadata migration, legacy values preserved, reruns tested and local migration executed.
- [x] Final source check 49/49; operational browser 10/10; strengthened scenario 1/1; authenticated browser 19/19.

No Phase 2 work started. Exact next task: owner native-language and physical-printer acceptance after the normal launcher is restored; readiness is recorded in PROJECT_STATUS.md. Existing absent payroll/procurement and production deployment work remain outside this improvement.

# Phase 1: record currency, customer dates and bills - 2026-11-20

Implemented the owner's Phase 1 brief across all four authorized branches. See [Phase 1 implementation](PHASE1_FINANCIAL_IMPROVEMENTS.md). Today's selected Kabul calendar date is accepted without a backdate grant; genuine historical order/payment backdating still requires its grant. Reservation dates remain unrestricted by an invented future-only rule. A Today picker action explicitly selects Kabul midnight; dates are saved as UTC instants and displayed in Asia/Kabul.

AFN/USD selection is shared by transaction registration, product/package catalog and expense entry. Payments inherit the immutable transaction currency and reject mismatched input; invoice versions and reversals preserve it. Catalog original-price currency is snapshotted separately from a negotiated transaction currency. Package currencies must match the transaction; selecting a new transaction currency clears package choices rather than silently converting prices. Offline payment limits apply only to their configured currency; other-currency payments require online validation.

Customer list/account totals, branch/company dashboards, reports/charts and exports preserve separate currencies. Report currency filters cover transaction totals, daily collections and expense totals. Customer rows have the existing authorized bill action before the ID, referencing that row's latest authorized transaction. Customer-only rows without a transaction show no fabricated bill. Filters share one responsive surface; Clear restores the default order/page and all filters.

Database: additive transactional rerunnable currencyMigration and scripts/database/migrate-currency.mjs backfill only missing metadata. Historical Dollar records retain USD; other active branches retain AFN. Payments inherit their scoped parent currency; orphan relations roll back. IDs, numeric amounts, balances, existing currencies, accounts and historical invoice snapshots are unchanged. No indexes/dependencies were added. Existing payroll, independent procurement, exchange conversion and operational Sham Shaban modules do not exist and were not invented by this improvement.

Verification in progress: initial npm run check PASS with 49 tests in six files, workspace types/lint/build/structure/PWA. A sandbox-only run failed to spawn esbuild (EPERM); the authorized external rerun passed. Follow-up source refinements and browser results are recorded below when complete. Exact next task: finish browser, final source/format checks and additive local migration/normal launcher readiness.

﻿# Login image framing and public action contrast - 2026-11-19

Owner screenshot identified a shallow cover-cropped login gallery and a public header hover style that turned the gold action emerald. Login now opts into BridalGallery complete framing: every photo uses contain, with a reserved image area and separate caption/control dock; public gallery presentation remains unchanged. Responsive short-desktop layout reduces decorative copy/spacing while retaining every authentication field and accessible submit. Form gains localized staff-access heading, semantic decorative label icons, improved focus/password states and refined card/submit treatment. Header/contact gold actions explicitly retain gold backgrounds and dark text through hover/focus/active in both themes.

No login/API/schema/branch/permission/account/dependency changes. Added browser regression checks all three photos, caption separation, short desktop submit reachability, mobile containment and light/dark gold hover colors. Actual verification belongs in PROJECT_STATUS.md. Next task: complete browser/visual acceptance, restore normal launcher and owner review at the reported viewport.

# Public storefront and login redesign - 2026-11-19

Implemented the owner's public/login visual follow-up: emerald/gold responsive public header with persisted theme control, richer Dari introduction and service/branch/contact sections, shared editorial bridal-image carousel, and a compact two-column login form with branded story, account guidance, back-to-company link and pending submit feedback. The public page now lists four active departments, with Dollar described separately rather than claiming it sells clothing. Contact/introduction remain configured via the existing public environment fields; no invented address, contacts, testimonials or inventory claims.

Shared BridalGallery uses three locally stored Pexels photographs with photographer/source links and explicit inspiration captions. CREDITS.md records source URLs and license. Local JPG files are precached; no third-party image request is needed at runtime. Gallery rotates every 6.5 seconds, supports manual dots/pause, pauses for hover/focus/hidden tabs, disables automatic rotation for reduced motion and has a branded fallback on image failure. New entry.css is scoped to the public/login experience; operational and print styling stay separate. Both themes and login's three languages are supported. Existing CAPTCHA, role/name/branch verification, sessions, passwords, errors and server authorization remain intact. No API/schema/index/dependency/credential changes.

Added browser coverage for both themes, image loading/manual selection, responsive containment, password visibility, timed autoplay/pause and failed-image fallback. Existing public branch count updated from three to four. Executed verification and screenshots belong in PROJECT_STATUS.md. Next task: complete browser/visual acceptance and restore the normal launcher, then owner review with configured public contact information.

# Full-width reference header and readable typography - 2026-11-19

Owner review identified the prior header as confined to the content column and Dari text as too small/faint. Implemented a fixed full-width desktop emerald header above both sidebar/content, always-visible MYT company identity, wide permitted-page finder, dual Kabul calendar date, themed appearance controls and existing branch/language/notification/profile actions. Sidebar starts below the header; mobile retains the accessible drawer and wraps header controls. Sign-out remains in the existing profile menu. Existing route, API, branch authorization and financial behavior are unchanged.

Added self-hosted variable Vazirmatn TTF from google/fonts (SIL OFL license shipped alongside it) for screen Dari/Pashto/English. Updated shared form/table/navigation/metric/helper sizes and text contrast; print typography remains independent. Font is included in PWA precache. Four branch comparison cards use a compact four-column desktop grid, preserving every existing real metric and authoritative branch name. No package dependency, API/schema/index/account/grant changes. Browser regression now checks nine widths in three languages, desktop header full-width bounds and loaded font, plus a Dari viewport screenshot. Validation is in PROJECT_STATUS.md; owner acceptance remains distinct.

# Owner image reference implementation - 2026-11-19

The supplied image now supersedes the earlier text-only visual baseline. Shared operational header and sidebar use deep emerald gradients, a CSS MYT wordmark, gold active navigation and visible gold keyboard focus. Dashboard welcome uses the same emerald/gold treatment; shared cards, table headings, page headings and modal headings carry the reference accents across all routes listed in ENTERPRISE_UI.md. Profile menus retain theme-aware surfaces and header controls retain readable contrast in both themes. No photo of a fictitious branch or sample statistics was introduced.

Existing themes, permission-filtered sidebar/top navigation, persisted preferences, RTL/LTR, responsive drawer, forms and API-backed workflows are retained. Existing branch names are authoritative; the sample image's geographical branch labels are not business configuration. No API/schema/index, credentials, permissions or dependency changes. Print styling remains screen-isolated. Added browser regression covers all permitted module routes, three languages/widths, theme/navigation persistence and a dashboard screenshot. Exact executed results and remaining acceptance belong in PROJECT_STATUS.md.

# Enterprise redesign - 2026-11-19

- [x] Audit current routes/components/workflows and record the phased implementation plan in ENTERPRISE_UI.md.
- [x] Shared light/dark screen tokens, controls, table/form/state styling and theme-aware charts.
- [x] Persisted sidebar/top modes with permission-filtered accordion/disclosures and RTL-aware keyboard navigation.
- [x] Profile/appearance controls, page finder, real notification preview and server-side list sorting/reset.
- [x] Portalled accessible single-scroll forms; compact confirmations; preserve print sizing and business behavior.
- [x] Full source check: 46 tests/six files, types, lint, builds and source/PWA validation.
- [ ] Complete new and existing browser acceptance and inspect screenshots.
- [ ] Restart normal local application after offline fixture build.
- [ ] Owner/native-language and physical-device acceptance.

# Unified customer form - 2026-11-19

- [x] Customer and complete first transaction in one modal across active branches.
- [x] Preserve atomic save, retry payload identity, offline behavior and permissions.
- [x] Read-only generated reference and derived table values.
- [x] Source check (46 tests), format check and Edge business acceptance (8/8); all-four-branch form/mobile coverage and visual screenshot inspection recorded in PROJECT_STATUS.md.
- [ ] Owner Dari form acceptance.

# Preview access - 2026-11-19

- [x] Eight-character simple normal passwords and localized UI.
- [x] Dollar accepted by authentication/account schemas.
- [x] Nine owner preview accounts created; API login/grants/isolation/logout verified.
- [x] Private separate handoff preserves original account files.
- [ ] Owner role/branch preview and replacement of temporary passwords before deployment.

# Consolidated completion review - 2026-11-18

Owner clarification on 2026-11-19 confirms Master Prompt 02 and 03 as this request's scope. Current source and their recorded requirements are the review basis. The original full prompt texts are not stored as standalone files, so this is not a claim of line-by-line acceptance against unavailable text. Historical checklists below retain their original evidence; this section takes precedence for current scope. Later dashboard/operations extensions are additional existing work.

- [x] Local authentication, account lifecycle, three roles, cookie sessions, CAPTCHA and signed offline authorization.
- [x] Four active branches, fixed AFN/USD currencies, central dashboard and branch navigation; Sham Shaban disabled.
- [x] Catalog, customers, atomic initial registration, transactions, installments/reversals, expenses, reports and audit.
- [x] Customer account history, authorized transaction corrections, per-payment receipts and paired continuation printing.
- [x] Offline queue/replay/conflict handling, persisted in-app reminders/messages and manual reviewed WhatsApp links.
- [x] Reconcile canonical scope/identity/currency documentation and correct the inventory generator's obsolete authentication description.
- [x] Fresh complete check: 45 tests/six files, types/lint/build/structure/PWA; Edge auth/UI 13/13 and business/printing/offline 7/7, completed 2026-11-19.
- [ ] Automatic external messaging: provider integration, credentials/configuration, delivery-attempt ledger and transport are absent. Provider selection and sending authorization are required before actual customer delivery.
- [ ] Independent partial delivery, existing-order product/package replacement and cross-transaction refund/allocation workflows are not implemented; business rules need definition before changing the physical-inventory/financial model.
- [ ] Production backup/restore tooling and exercises, TLS/hosting, index migration review, retention/key rotation, distributed abuse controls and independent security review.
- [ ] Owner/native-language acceptance, real-device/PWA installation and physical A4 printer acceptance.
- [ ] Hosted CI execution evidence; local verification does not establish remote CI success.

Fresh verification results are recorded at the top of PROJECT_STATUS.md and VALIDATION_REPORT.md. Do not mark external services, physical acceptance or production deployment complete based on local automated checks.

# Admin dashboard follow-up - 2026-11-18

- [x] Open admin Overview on all four branches after returning from a branch.
- [x] Keep explicit branch selection and Dollar branch workflow intact.
- [x] Extend the existing browser scenario and pass focused Playwright validation.
- [ ] Owner visual/native-language and physical-device acceptance remains open.

# Premium system interface - 2026-11-13

- [x] Read owner brief, repository guidance, source, module docs and exact locked UI dependencies.
- [x] Shared premium screen palette/surfaces/forms/tables/buttons/modals and login.
- [x] Desktop collapse, mobile drawer, overlay/Escape/focus/inert controls and profile menu.
- [x] Role dashboards with real metrics/charts, quick actions, notifications, activity and delivery states.
- [x] Dari/Pashto/English resources, RTL/LTR and reduced-motion policy.
- [x] Preserve backend RBAC/contracts and print sizing; no new dependencies/migrations.
- [x] Required source check passed with 40 tests, lint/types/build and artifacts before final visual iteration.
- [x] Pass final 40-test source check and 11-scenario auth/UI suite; inspect responsive screenshots.
- [x] Pass all six existing business/print/offline browser regressions (37.5s); update legacy navigation-label selector.
- [x] Normal launcher START exit 0, backend ready/frontend HTTP 200; redesigned application left running.
- [ ] Owner visual/native-language and physical-device acceptance.

# Master Prompt 03 task tracker ? 2026-11-13

- [x] Inspect supplied prompt, actual authentication/business source and earlier documentation.
- [x] Real admin/manager/employee login, name/email/role/branch validation and CAPTCHA.
- [x] Argon2id, opaque cookie sessions, refresh rotation/reuse revocation, password lifecycle.
- [x] Branch-scoped account management, status, sessions and safe security audit.
- [x] Close delegation via role defaults/catalog expansion and respect global session deny.
- [x] Signed device-bound offline lease and sync-independent validity/revocation checks.
- [x] Role dashboards, exact delivery counts and recent customer registrations.
- [x] Notification/message persistence, reviewed WhatsApp sharing and existing print integration.
- [x] Provision seven initial local owner accounts without resetting existing accounts; private Acount handoff.
- [x] Update master/security/permissions/schema/API/architecture/offline/environment/install documentation and generated inventories.
- [x] Pass 40 source/database tests, strict types, lint, production builds and artifact checks.
- [x] Pass nine Edge authentication/account/message/sharing/signed-offline-expiry scenarios; inspect settled mobile screenshots.
- [x] Verify signed offline reload/eight-hour expiry and all six prior business browser regressions; live startup evidence is recorded in PROJECT_STATUS.md.
- [ ] Production TLS/hosting, backup/restore tooling/exercises, retention/key rotation, distributed controls and independent security review.
- [ ] Native language, physical printer/device and PWA-install owner acceptance.

The historical task tracker below is retained; external identity is no longer required for the implemented local cookie-session authentication.

# Task tracker - 2026-11-13

- [x] Foundation folders, workspace dependencies, strict tooling and CI configuration.
- [x] Existing business source inspected; documentation reconciled without login/account creation or Sham Shaban operations.
- [x] Installed versions checked; no new dependency or schema introduced this session.
- [x] Fix offline query/mutation pausing and exercise real reload/replay/conflict paths.
- [x] Structured rate-limit response, localized feedback and regression coverage.
- [x] Exclude generated artifacts from source tools; format existing source.
- [x] Run source checks: 22 tests and all builds pass.
- [x] Run Edge acceptance: all five scenarios pass; inspect mobile/print screenshots.
- [x] Check runtime audit (0) and full audit (4 low, no moderate/high/critical).
- [x] Verify STOP process ownership and PowerShell syntax.
- [x] Verify START from stopped isolated database, live readiness/frontend HTTP and safe duplicate-launch rejection.
- [ ] Accept physical devices, desktop PWA installation, native language/calendar labels and physical/long-invoice printing.
- [ ] Resolve compatible upstream build-tool advisories when available.
- [ ] Execute hosted CI; no remote run claimed.
- [ ] Complete external production identity/provisioning, reviewed migrations, offline retention/recovery, TLS/hosting and backup/restore acceptance before commercial deployment.

## Branch expenses - 2026-11-13

- [x] Implement six-field form and table with search/pagination and three-language labels.
- [x] Enforce server-side active-branch isolation, explicit read/create permissions and exact positive AFN minor units.
- [x] Implement transactional idempotent command/audit and online-only client path.
- [x] Add and apply explicit additive migration without changing existing business records.
- [x] Pass 25 source/database tests and six full Edge scenarios.
- [x] Pass targeted saved Jalali-date and Dari mobile expense check (1/1).
- [x] Confirm updated START exit 0, live frontend/backend and each active branch expense endpoint.
- [ ] Owner acceptance of expense labels/permissions and real expense workflow.

## Operations completion - 2026-11-18

See [operations completion](OPERATIONS_COMPLETION.md) for current implementation, additive migration, currency rules, atomic registration, account history, transaction corrections, paired continuation printing and explicit limitations. This supersedes the older three-active-branch/AFN-only/print-default descriptions. Verification is recorded in PROJECT_STATUS.md.

Final targeted acceptance: strengthened module test PASS 1/1 in 21.5 seconds after waiting for loaded module skeletons and all four dashboard branch cards. Final dashboard screenshot .local/print-validation/reference-dashboard.png visually inspected: emerald/gold header/sidebar/welcome, all four authoritative branch cards and empty states display correctly on the disposable empty fixture. Full suite remains PASS 9/9 from the preceding run. Final format:check PASS. Next task: owner review of Dari presentation with normal business data, native-language and physical-device/printing acceptance; these remain distinct from browser evidence.

Targeted final browser acceptance PASS 1/1 in 21.0 seconds on the finished runtime build, including RTL profile dropdown viewport containment and the updated Dari screenshot. Full suite PASS 9/9 and final source check PASS 46/46 remain recorded above. Owner review of the actual normal-data Dari interface is next; physical devices/printers remain unverified.

## Final entry-page browser acceptance - 2026-11-19

npm run test:auth:e2e PASS 18/18 in 1.7 minutes against guarded disposable fixtures. Covers public route isolation, login/CAPTCHA and all role login/logout scopes, offline session expiry, account lifecycle/revocation, notifications/sharing/print/report downloads, existing operational RTL/dark/theme/navigation/modal regressions plus new gallery/theme/manual slide/rotation/pause/image-failure cases. Logout test helper now opens the actual profile menu rather than targeting the removed historic direct-header button. No real credentials or records were changed. All three languages and mobile/desktop layouts passed.

Visually inspected .local/clothing-validation/home-desktop.png, .local/auth-validation/login-fa.png, login-light.png, login-dark.png and public-dark.png. Local photography displays correctly; dark/light forms, labels, CAPTCHA and actions remain readable. Sources and license are in frontend/public/images/bridal/CREDITS.md. Final npm run check and launcher readiness are recorded next. Next task: owner reviews imagery/copy and supplies public contact/address via the existing configuration when ready.

## Login framing follow-up evidence

Initial auth/public suite: 18 existing tests PASS; the new framing/hover test reached its second theme before a test-only navigation race (theme button queried before login mounted). Replaced direct DOM click with awaited visible login and Playwright button locator. Targeted framing/hover rerun PASS 1/1 in 14.2 seconds, covering all three photos, caption separation, short 1366x640 submit visibility, 390px layout and light/dark gold hover. Screenshots visually inspected: login-fa.png, login-complete-light-1366.png and public-hover-dark.png. Removed fallback emblem visibility behind present login photos after screenshot review; image-failure fallback remains. Final source check and refreshed screenshot verification follow below. No real records changed.
