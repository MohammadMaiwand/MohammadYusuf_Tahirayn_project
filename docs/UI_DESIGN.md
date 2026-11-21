# Login image framing and public action contrast - 2026-11-19

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

# Enterprise experience expansion - 2026-11-19

[ENTERPRISE_UI.md](ENTERPRISE_UI.md) is the current application-wide redesign reference and route inventory. It supersedes earlier sidebar-only/light-only and non-portalled modal presentation descriptions below. Existing role dashboards, real API data, print rules and business behavior are preserved. Execution evidence is recorded at the top of PROJECT_STATUS.md.

# Admin overview scope - 2026-11-18

The admin company overview defaults to all active branches whenever its dashboard component is opened. Branch selection is a temporary dashboard scope; it changes the active branch and shows the existing branch dashboard but does not persist the dashboard-only scope across route navigation. Returning to Overview therefore restores the four-branch cards, including Dollar Department. The active branch preference remains separate for branch-scoped operations.

# Premium interface design

2026-11-13, Asia/Kabul. The owner extends the supplied Premium Manager Dashboard brief to the entire existing system. This supersedes the brief's manager-only visual scope, while preserving role behavior, permissions, routes and backend business rules. No screenshot was attached with the text brief; the current source and rendered application are the visual baseline.

## Shared screen system

frontend/src/styles/premium.css defines a screen-only theme using deep emerald/forest green, muted champagne, warm light canvas, white surfaces, charcoal text and restrained semantic colors. Shared buttons, inputs, filter toolbars, tables, status pills, pagination, forms, modals, notifications, skeleton/error/empty states and login inherit this language. Essential typography uses the existing locally available Segoe UI/Tahoma stack; there is no external font or asset service dependency.

The shell retains all existing routes and permission checks. Desktop sidebar collapse persists a nonsensitive preference; narrow screens use a drawer with overlay, Escape, focus containment, focus return, background scroll lock and inert closed navigation. Native profile details provides account/session navigation and sign-out, closes on outside click/Escape/route changes, and works with keyboard. Branch/language/date/notification controls remain permission aware. Labels use local Dari, Pashto and English resources. Logical CSS properties support RTL/LTR.

Print geometry remains in print.css. The new theme is wrapped in @media screen so A5 and paired A4 physical sizing and printed business data are not restyled. Print preview controls receive the shared screen styling.

## Dashboard components and data

DashboardPage.tsx composes role-specific layouts, company/branch selection, authorized recent records and notifications. DashboardWidgets.tsx contains the personalized welcome, permission-filtered quick actions, real metric cards, payment history area chart, purchase/rental donut, notifications and Kabul-calendar delivery badges. Admin aggregates only the authorized comparison response; manager uses the existing branch dashboard endpoint; employee retains a simple operational workspace without management metrics.

Recharts 3.10.1, React 19.3.1 and Lucide 0.548.0 are already locked/installed. There is no installed motion library; lightweight CSS transitions/keyframes, requestAnimationFrame and IntersectionObserver provide the requested effects without adding a dependency. Exact money labels use existing BigInt-aware formatting; count-up interpolation uses integer arithmetic. Chart coordinates use approximate Number values only for plotting, with exact amounts in tooltips and a keyboard-accessible data table. Donut legends expose category counts. No invented statistics, trends or random growth figures are used. Existing newCustomers represents the preceding 30 days, and labels preserve that meaning rather than claiming a calendar-month comparison.

Short entrances, staggered metric cards, hover/tap feedback, dropdown/modal transitions and skeleton shimmer respect prefers-reduced-motion; count-up/chart animation also checks that preference. Chart heights are reserved to avoid layout shifts. Empty/error states remain distinct, and failed API data is not shown as zero statistics. Quick actions navigate existing workflows; recording a new transaction/payment remains inside the existing customer/transaction detail flow.

## Verification and limits

Actual checks, browser evidence, screenshots and any discovered failures are recorded in PROJECT_STATUS.md and VALIDATION_REPORT.md. Browser acceptance covers common routes, desktop collapse/profile controls, mobile drawer, 320/390/768/1280/1440 widths, all three languages, reduced motion, real chart data and manager avoidance of global endpoints. Existing auth, offline lease, financial/offline replay/conflict and printing acceptance must remain passing.

No backend API, business rule, database schema, index or migration change is part of this redesign. Initial owner account handoff and private credentials are unchanged. Physical-device, printer and native-language approval remain owner acceptance work. This design update does not resolve the previously documented production hosting, backup/restore or independent security-review requirements.

## Login framing follow-up evidence

Initial auth/public suite: 18 existing tests PASS; the new framing/hover test reached its second theme before a test-only navigation race (theme button queried before login mounted). Replaced direct DOM click with awaited visible login and Playwright button locator. Targeted framing/hover rerun PASS 1/1 in 14.2 seconds, covering all three photos, caption separation, short 1366x640 submit visibility, 390px layout and light/dark gold hover. Screenshots visually inspected: login-fa.png, login-complete-light-1366.png and public-hover-dark.png. Removed fallback emblem visibility behind present login photos after screenshot review; image-failure fallback remains. Final source check and refreshed screenshot verification follow below. No real records changed.
