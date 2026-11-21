# Smart Auto Answer source import - 2026-11-21

Added the independent desktop/browser-extension project under smart_auto_answer/ at the owner's request. Preserved the existing management system and Git history. Included source, build scripts, documentation, tests and packaged browser extensions; excluded installed dependencies, Python caches, generated executable/build work, runtime logs and exports. No management-system dependency, API, schema or business behavior changes. Updated inventory exclusions for local artifacts. Validation: imported extension detector tests PASS (19/19); candidate secret-pattern scan found no matches; source inventory regenerated; full management-system checks were not rerun for this independent source import. existing historical test results do not validate this import. Next task: verify the published main commit and review the imported project separately.

# GitHub source publication - 2026-11-21

Validation for this publication: npm run check PASS (66/66 tests, types, lint, all builds, structure and PWA artifacts); npm run format:check PASS. First sandbox run hit esbuild EPERM; the first unrestricted run found the isolated MongoDB stopped and timed out before integration tests. Started the existing isolated replica set with npm run db:dev, preserving data, and the full rerun passed. Existing Zod annotation and bundle-size warnings remain. Hosted CI and browser acceptance were not rerun for this source-publication task. README formatting and a trailing space in the font license were normalized without changing their meaning.

Owner requested publication of the complete project to the configured GitHub origin on main. Source, lockfile, launcher, tests, documentation and supplied project references are included. Existing README history is preserved. Private Acount handoffs, real environment files, local databases, runtime logs, dependencies and generated builds remain ignored. No dependency, API, schema, migration, account or business-rule changes were made. Pre-publication checks confirmed the remote main baseline and no candidate files above 50 MiB or matches for common private-key/token/credential-bearing MongoDB URI patterns. Publication and final verification are recorded in the delivery response; this preparation entry does not claim a completed push. Next task: verify the remote commit after push and review hosted CI separately from local checks.

# Local login without internet - 2026-11-21

Fixed the normal local login pointing at an obsolete temporary Cloudflare API override. Restored the ignored frontend/.env.local API URL to loopback. frontend/src/lib/env.ts now routes development pages opened on localhost/127.0.0.1 through the existing same-origin Vite /api proxy, preventing a leftover tunnel override from breaking local CAPTCHA/login. Public tunnel hosts and production builds retain their explicitly configured API URL. The local backend and MongoDB must remain running; internet is unnecessary for local authentication. Existing signed-lease rules still apply when the backend itself is unavailable.

No dependency, schema, migration, password, grant or business-record change. Existing launcher-owned servers were restarted using the normal launcher; separate review hosting was untouched. Exact locked versions inspected: Vite 7.3.8 and Vitest 5.1.0. Required npm run check PASS: 66/66 tests, types, lint, builds, structure and PWA checks. Initial sandbox test attempt hit esbuild spawn EPERM; approved rerun passed. Existing upstream annotation/bundle warnings remain. Actual Edge verification blocked all external HTTP requests: admin/manager/employee CAPTCHA, login, dashboard, reload and logout PASS. No credentials printed. Next task: owner reloads the local login and confirms use with internet disconnected while the local launcher stays running.

# Temporary customer review preview - 2026-11-20

Prepared an isolated, authenticated free Cloudflare HTTPS review link at https://emma-collapse-poker-leader.trycloudflare.com after the owner requested autonomous hosting setup. Independent Render/Atlas hosting remains unperformed because browser/account access and provider tokens were unavailable; the user was explicitly told the fallback depends on this computer/internet. See [customer review lifecycle](CLIENT_REVIEW.md).

Separate local review database and sample seeder verification PASS 121/121 with 231 sample commands. Nine new review-only accounts and a single customer administrator handoff are saved privately under Acount/CLIENT_REVIEW*. Normal business data/accounts, app source/configuration, normal build and launcher processes are preserved. Development identity is disabled on the review API; cookies use production Secure/HttpOnly/SameSite Strict behavior. Public homepage/login/readiness HTTP 200; anonymous session/customer API access 401. Final public browser verification is in progress. Exact next task: complete the real-HTTPS login/cookie/scope/logout checks and hand off the temporary URL plus private customer login; independent cloud hosting still needs provider account access.

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

# 2026-11-20 - Manager advertisements are branch-scoped

The owner later requested the same advertisement tools for managers. This supersedes the earlier admin-only management decision, but not the rule that branch users may access only their assigned branch's records. Admin manages company-wide and all branch ads; each manager manages only ads created for their own active branch; employees remain denied. Existing ads remain company-wide and continue to publish normally. Manager-created ads/images store nullable branch ownership and join the public home list only when active and in schedule. Public WebP images alone opt into cross-origin embedding because the UI and API use separate origins; all other Helmet policies remain unchanged.

# 2026-11-20 - Company-wide advertisements and responsiveness pass

The owner asked for an admin advertisement manager that publishes dynamically to the public landing page before login, plus a general speed-up, without disturbing the running system. Advertisements are modelled as company-wide content, not branch-scoped, published only to the public site root and never the login form, and gated by a single admin-only permission (advertisements.manage) with no manager/employee default. Uploaded photos reuse the existing sharp pipeline and are stored as immutable blobs in their own collection so authenticated clothing-photo access and authorization stay untouched; the public image route serves only images still referenced by a record. No CDN or runtime third-party image request is introduced. Responsiveness is improved only through client cache/interval and server cache-header tuning — no new dependency and no startup schema/index change. Additive explicit migration scripts/database/migrate-advertisements.mjs follows the alterations convention. Details in API_DOCUMENTATION.md, PERMISSIONS_DOCUMENTATION.md, DATABASE_SCHEMA.md and PROJECT_STATUS.md.

# 2026-11-20 - Authorized Phase 2 garment alterations

The owner's attached Phase 2 brief authorizes a new alteration ledger integrated with existing customers, optional transactions, branch permissions, photos, notifications and printing. Use one shared implementation, no duplicate inventory/customer system. Original garment amount/currency stay immutable and separate from service-charge currency, including independently verified linked transaction snapshots. Report booked service charges separately; never manufacture payment collection, alter sale balances or label this work receipt as paid. Preserve original invoices. Reuse hardened image storage/processing with purpose-aware access rather than adding a second upload service. Routine employees can operate only their own alterations; branch managers/admin receive management-only reminders. Notifications use the existing server timer and durable eventId uniqueness, transactional concurrency, Kabul dates and independent read acknowledgements. Online-only alteration requests avoid adding new sensitive offline caches. Use explicit additive migration rather than startup index changes. Physical/production acceptance stays separate from local tests; details/evidence in GARMENT_ALTERATIONS.md and PROJECT_STATUS.md.

# 2026-11-20 - Phase 1 per-record AFN/USD supersedes branch-fixed currency

The owner's supplied Phase 1 brief explicitly requires selectable AFN/USD in every existing financial module and branch. Preserve historical meanings using Dollar USD/other branches AFN only for missing legacy metadata; never relabel old currency or convert values. Reuse existing schemas/commands, exact minor-unit arithmetic and print templates. Transactions lock their currency; package/payment currency mismatch is rejected. Separate catalog original-price currency prevents negotiated prices from relabelling the original price. Scalar customer/report compatibility fields describe one labelled currency; separate accounts/charts prevent mixed sums. No new index/dependency, payroll or unauthorized branch module. The scalar offline limit remains denominated in its configured currency; fail closed on other-currency offline payments. Today is compared by Kabul calendar day rather than midnight versus current time, retaining genuine backdate permissions. Migration and tests are explicit; see PHASE1_FINANCIAL_IMPROVEMENTS.md and PROJECT_STATUS.md.

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

# Enterprise UI/UX redesign - 2026-11-19

Implemented the supplied complete enterprise redesign brief on the existing React application. Audit, plan, route coverage and contracts: ENTERPRISE_UI.md. Added centralized light/dark screen tokens, persistent theme/navigation preferences (also on login), permission-filtered sidebar accordion and horizontal keyboard-accessible dropdown navigation, profile preference controls, a Ctrl/Cmd K permitted-page finder, real notification previews, remembered server-side sort/direction and filter reset on customers/transactions, and consistent shared controls/loading/status/validation/toast states. Existing real dashboards/charts inherit theme tokens. All existing routes and business workflows are retained.

Replaced transformed-ancestor modals with body portals, background inertness/scroll lock, topmost Escape, visible focus containment/return and a single scrollable modal body. Long customer/transaction/catalog/account forms use near-full-screen workspaces with visible headings; small confirmations remain compact. Removed internal package-list scroll and made date pickers inline within forms to avoid clipped popups. Print geometry is independent of screen theme. No backend/API/schema/index/account/permission/credential or dependency/lockfile changes.

Verification so far: npm run check passed (46 tests/six files, strict workspace types, lint, all builds, structure and PWA artifacts). PWA has 36 precache entries; upstream Zod annotation and approximately 650 kB main-chunk warnings remain non-fatal. A preliminary type check identified an exactOptionalPropertyTypes mismatch in the new optional dialog description; it was corrected before the passing complete check. Browser acceptance and visual evidence follow below. Existing local servers were stopped via the verified launcher for isolated browser tests; MongoDB and real business records are preserved. Exact next task: complete browser/visual acceptance, restart the regular local application, then owner/native-language and physical-device review.

# Unified new-customer registration - 2026-11-19

Replaced the two-step customer/initial-transaction UI with one modal containing the existing editable customer fields and complete transaction controls. The shared form applies to all four active branches and every existing entry point using CustomerForm. Existing-customer editing and add-transaction workflows remain available. Callers without transaction creation permission retain the permitted customer-only form; permissions are not bypassed.

The form shows generated reference information, product/type, prices/discount/charges/packages, initial payment/method, reservation/return/order dates, guarantee, notes, calculated total/paid/balance/days and initial delivery state. Reference IDs and financial/day/state summaries remain system-generated, not arbitrary editable values. Optional business fields retain their existing optional validation. Customer details remain editable until final submission. Existing atomic customer.register command, branch isolation, offline queue and server authorization are reused. Retry hashes now include customer details so edits cannot reuse the prior request payload identity. No backend API/schema, migration or dependency changes.

Browser regressions now fill customer and transaction details without Continue to transaction; added all-four-branch immediate-field/cancel/mobile coverage. Final verification results follow in PROJECT_STATUS.md. Next task: owner acceptance of the unified Dari form and catalog configuration in each branch. Earlier two-step descriptions are superseded by this record.

# Owner preview accounts and simple passwords - 2026-11-19

Owner explicitly requested simple local preview credentials. Normal create/reset/change password validation now accepts 8?128 characters without composition rules; matching UI minimums and three-language hints were updated. Login continues to verify existing hashes without applying a new-password minimum. The six-character owner preview secret is provisioned only by the ignored local setup script, without a general validation bypass. Passwords remain Argon2id hashed; CAPTCHA, cookie sessions, branch checks and role boundaries remain active.

Created nine local development preview accounts: one global admin and manager/employee pairs for all four active branches. Every account has all permission grants, with role/service branch boundaries still enforced. Unique normalized email is preserved: the admin uses the owner-requested email, other accounts use branch/role plus-addresses. Exact credentials are only in private Acount/MAIHAN_PREVIEW.txt and MAIHAN_PREVIEW.json. Existing unrelated accounts and business records are preserved. Sham Shaban remains disabled. No dependency or database index/schema change.

Corrected the auth account/login branch validator to accept Dollar, matching the existing branch picker and configuration. Added a regression for short-password denial, simple eight-character acceptance, Dollar login and cross-branch denial. All nine actual preview logins, complete permission grants, cross-branch denial and logout passed through the real auth API in an in-process local verification. Full check results follow when completed. Next task: owner previews each role using the private handoff, then replaces temporary credentials before deployment.

# 2026-11-18 - Consolidated completion evidence

Treat implemented local workflows, provider-dependent work, business-rule gaps and owner/production acceptance separately. Do not equate an existing module/menu or historical test result with complete acceptance of unavailable original prompt text. Correct current canonical descriptions and the inventory generator so regeneration cannot reintroduce the superseded no-login claim. Preserve historical records; initial credentials remain private and existing accounts/data are not reset by this review.

# 2026-11-18 - Admin dashboard scope is transient

Do not persist a selected branch as the admin dashboard's initial scope. The company Overview must reopen with all four active branch cards; branch selection remains an explicit in-session action and the top-level active branch preference remains available for operations. This prevents a prior visit to Dollar or another branch from hiding the company-wide entry view.

# 2026-11-13 - Premium design scope and accessibility

The owner's explicit request extends the attached manager-only design brief to all system screens. Keep backend contracts/RBAC and invoice print dimensions unchanged. Use screen-only shared CSS tokens rather than replace working feature pages. Reuse locked Recharts/Lucide and native/CSS/browser motion because no motion library is installed. Use real API data only; preserve the 30-day new-customer definition and avoid unsupported growth trends. Exact money remains integer-based for labels/count-up; numeric chart coordinates are visual approximations with exact tooltip/table values. Respect reduced motion, logical RTL layout, inert closed drawers and keyboard focus controls. Preserve local fonts and offline assets; no font CDN or dependency introduced.

# 2026-11-13 ? superseding Master Prompt 03 decisions

Owner authorization supersedes no-login/no-account restrictions. Keep existing User/business models and use opaque, hashed, revocable HttpOnly cookie sessions instead of browser-held bearer secrets. Keep exactly admin/manager/employee; migrate legacy user and fail closed for legacy accounts without status. A manager's delegation ceiling includes effective defaults and implication expansion. Admin deny overrides apply to global session management. Sign bounded device authorization leases; independent identity checks must not depend on the business sync feature flag. Preserve local business cache/outbox on logout for recovery, remove its lease and clear queries. Account handoff is deliberately local/private and excluded from logs/source control. Operational Sham Shaban remains excluded.

# Decisions log

2026-11-12 — Phase 1:

- Use the currently opened root directly; npm workspaces share lockfile and strict TypeScript baseline.
- Compile a real @myt/shared ESM package before frontend/backend consumers, avoiding runtime TypeScript alias resolution.
- React 19 satisfies React 18+. Tailwind 4 uses its Vite integration. Express 5 uses a centralized app factory for testability.
- Node 26.13.0 is the installed LTS runtime; target Node 26 for CI and local instructions, minimum engine 24.
- Shared database, no business collections or seeds in this phase. Branch schema/index factory remains unregistered. Business authorization is mandatory before any module API.
- Keep Sham Shaban disabled in static configuration only. Never create records for it in this phase.
- JWT verifier only; no authentication UI, login, accounts or token issuance. Argon2 is reserved for future identity work.
- Calendar presentation uses Intl Persian calendar in Asia/Kabul; jalaali-js supports later date-only pickers. Store instants in UTC and date-only values as explicit ISO date strings. Afghan month naming requires native speaker review.
- PWA static shell precache only; Dexie metadata schema only. No business caching or offline writes until authorization and conflict rules exist.
- Generate manifest in public with manifest:false in PWA plugin to avoid duplicate manifests. Add actual PNG icons rather than empty icon placeholders.
- Windows launcher uses verified process identity (PID + creation time + script command), exclusive lifecycle lock and per-process logs. It never stops MongoDB and starts only a configured existing local service.
- Proposed roles and financial/printing rules remain planned. No fabricated operational features or production readiness claims.

- Use stable jalaali-js instead of the date-fns-jalali fork whose published release uses a prerelease suffix; retain date-fns for future standard date utilities.
- Launcher process-ownership testing exposed nested JSON-array handling in Windows PowerShell. Parse the state array directly, compare creation ticks as strings, and compare Windows script paths without case sensitivity. A rerun verified that STOP preserves a process whose creation identity does not match.
- Created ignored local environment files only when absent. Discovered local MongoDB service is configured, but starting it failed because the current Windows account could not open the service. Do not bypass Windows service permissions or create an alternate database.

- Update unsupported ESLint 9 to ESLint 10, old Vitest to 5.1 and PWA tooling to 2.0; apply tested glob/minimatch security overrides. Preserve the remaining low deepmerge issue explicitly; avoid incompatible automatic downgrades.
- Windows PowerShell native stderr warnings interrupted START under ErrorActionPreference Stop. Build/config probes now use hidden Start-Process with separate stdout/stderr logs and exit-code checks. START reaches the intended MongoDB permission blocker.

2026-11-13 ? validation and development lifecycle:

- Existing business source was discovered beyond stale Phase 1 documentation; preserve it and record actual behavior under repository Master Prompt 02 authorization. No login/accounts or operational Sham Shaban were added.
- Supersede the earlier prohibition on an alternate development database for this explicit completion task: use only the already present isolated replica set on loopback 27018; preserve existing Windows service data. Launcher startup requires explicit MONGODB_DEV_MANAGED opt-in and exact local URI/replica-set matching; STOP still stops only owned application processes.
- Preserve default 120/minute/IP limit. Browser acceptance exercises many users/devices back-to-back, so its temporary server explicitly uses RATE_LIMIT_MAX=2000. Add structured 429 errors and regression coverage instead of disabling rate limiting.
- CI now starts a disposable MongoDB replica set for existing real-database integration tests. Hosted CI has not been executed here. Exclude ignored .local binaries/data/artifacts from generated source inventory.

2026-11-13 offline regression fix: TanStack Query previously paused mutations and uncached reads before the application outbox/cache handlers could execute. useSave mutations and query defaults now use networkMode:always, allowing the existing handlers to decide between server and local storage. Browser tests exercise customer/transaction/payment creation, reload, reconnect and explicit cross-device conflict review. No authorization checks were removed. ESLint/Prettier now exclude generated .local browser reports; mobile screenshots wait for drawer animation completion.

Windows lifecycle correction (2026-11-13): Start-Process -Wait follows descendants, so the detached mongod caused the launcher to wait indefinitely after the helper reported readiness. WaitForExit now waits only for the helper process. The stalled test launcher was identified and stopped without stopping unrelated applications; the isolated database was shut down through its verified helper before retesting.

## Expenses addition - 2026-11-13

User explicitly requested expenses with six fields and separate branch tables. Preserve the shared database architecture: a single expenses collection plus mandatory branchId filters and branch-scoped indexes. Use positive integer AFN minor units, append-only records, explicit additive migration and online-only writes. No expense net-profit/cash-ledger changes are implied. Default active-branch users may read/create, subject to existing deny overrides.

## Operations completion - 2026-11-18

See [operations completion](OPERATIONS_COMPLETION.md) for current implementation, additive migration, currency rules, atomic registration, account history, transaction corrections, paired continuation printing and explicit limitations. This supersedes the older three-active-branch/AFN-only/print-default descriptions. Verification is recorded in PROJECT_STATUS.md.
