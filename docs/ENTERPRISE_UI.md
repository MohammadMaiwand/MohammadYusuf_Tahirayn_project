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

# Enterprise experience redesign - 2026-11-19

## Audit and implementation plan

The supplied Complete Enterprise UI/UX Redesign prompt is the current scope. The existing premium shell, role dashboards, lazy routing, real-data charts, localization, printing, scoped API/cache and business forms are retained. Four active branches are Royal, Aroos, Aroos VIP and Dollar; Sham Shaban remains excluded. No dependency, API, database or authorization changes are needed.

Audit found missing horizontal navigation, theme selection, remembered navigation preferences and accessible presentation of long forms. A retained transform on the animated app-content ancestor created the clipped fixed modal shown by the owner; both backdrop and modal also scrolled. The redesign addresses these through shared components rather than replacing working modules.

Implementation order:

1. Central light/dark screen tokens, surfaces, typography, controls and statuses.
2. Shared permission-filtered navigation model, sidebar accordion, horizontal disclosure menus, persistent appearance controls, profile preferences, notification preview and keyboard page finder.
3. Portalled accessible dialogs, focus return/trap, background inertness/scroll lock and one scroll region. Large registration, transaction, account/permission and catalog forms use near-full-screen workspaces; confirmations remain compact.
4. Shared buttons/loading/error/empty/toast states, labeled validation, placeholders, list order/direction and filter reset using existing server contracts.
5. Validate both navigation modes, both themes, three languages, all roles/branches, responsive layouts, real business workflows and print isolation. Record actual results in PROJECT_STATUS.md.

## Existing route and module coverage

| Existing route                                              | Shared design and workflow preserved                                                                         |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| / and /login                                                | Public content, language-aware login/CAPTCHA, theme inheritance                                              |
| /dashboard                                                  | Role-specific real KPIs/charts, company overview and four-branch selection                                   |
| /customers, /customers/:id                                  | Search/filters/sort, account history, single-form atomic registration, edit/payment/print actions            |
| /transactions, /transactions/:id                            | Search/filters/sort, product reservations, payments/reversals/corrections and invoice snapshots              |
| /products, /product-categories, /guarantees, /package-items | Catalog, photos, existing inventory fields, search/filter/pagination and create/edit/deactivate confirmation |
| /expenses                                                   | Branch expense form, date selection, search and pagination                                                   |
| /users                                                      | Account lifecycle, role/branch assignment and grouped permission controls                                    |
| /sessions                                                   | Sessions, revocation and password lifecycle                                                                  |
| /notifications                                              | Persisted branch-scoped reminders/messages and read controls                                                 |
| /reports, /audit-logs                                       | Existing real report/export/audit endpoints and date filters                                                 |
| /settings                                                   | Branch configuration and confirmation                                                                        |
| /sync                                                       | Existing encrypted queue, explicit conflict review and replay                                                |
| /print/:id, /print/local/:localId                           | Existing immutable invoice output, A5/paired A4 and continuation geometry                                    |

All routes use the common screen theme; print rules remain independent. Destructive operations remain limited to existing supported business actions; this redesign does not invent financial deletion or bulk commands. Sorting submits allowlisted fields/direction to the existing paginated API; it does not locally reorder one page and claim to sort an entire dataset. Only presentation preferences are persisted, never search terms or record contents.

## Interaction and accessibility contracts

- Appearance controls persist light/dark and sidebar/top modes in nonsensitive local preferences across refresh/login. Login inherits the chosen theme. On narrow screens both navigation preferences use the accessible drawer.
- Navigation visibility uses the same permission checks as existing routes; branch changes continue through the existing authorized context/cache reset. Page finder searches permitted route labels and opens with Ctrl/Cmd K; it makes no additional business queries.
- Sidebar groups are an accordion, automatically opening the current route group. Collapsed desktop navigation exposes icon links with native title tooltips. Top disclosures close on outside click, route change or Escape; arrows/Home/End navigate their links and horizontal summaries mirror RTL.
- Dialogs live directly under body, outside transformed route content. Background root is inert while open, body scrolling is locked and restored with nested-dialog accounting, and keyboard focus is contained/restored. Large form headings remain visible; only modal-body scrolls.
- Shared Field associates inline validation/helper text, marks required inputs, preserves registered input/ref/event props and uses existing labels for placeholders. Existing runtime schemas still govern required/optional business fields.
- Shared buttons provide variants and optional processing indicators; mutations keep their existing pending/duplicate protection. Dismissible toasts and real notification previews keep existing message data and controls.
- Reduced motion disables decorative transitions/animations. Dark screen styles do not recolor invoice print output or alter physical page dimensions.

## Verification

Implementation is not acceptance evidence. Full source checks, browser results, screenshots, initial failures and remaining physical-device/native-language limitations are recorded in PROJECT_STATUS.md. Owner acceptance remains separate from browser verification.

## Reference-image acceptance follow-up

Browser acceptance exposed a pre-existing product search labeling issue: the input and datalist are siblings inside Field, so the implicit label included loaded option text. Added an explicit localized aria-label on the product search input to keep its accessible name stable as options load. This preserves validation, search and business behavior. The first suite stopped at that assertion after one passing test; the corrected suite is recorded in PROJECT_STATUS.md. The new appearance regression uses the actual translated English control name, Color theme.

Final targeted acceptance: strengthened module test PASS 1/1 in 21.5 seconds after waiting for loaded module skeletons and all four dashboard branch cards. Final dashboard screenshot .local/print-validation/reference-dashboard.png visually inspected: emerald/gold header/sidebar/welcome, all four authoritative branch cards and empty states display correctly on the disposable empty fixture. Full suite remains PASS 9/9 from the preceding run. Final format:check PASS. Next task: owner review of Dari presentation with normal business data, native-language and physical-device/printing acceptance; these remain distinct from browser evidence.

Targeted final browser acceptance PASS 1/1 in 21.0 seconds on the finished runtime build, including RTL profile dropdown viewport containment and the updated Dari screenshot. Full suite PASS 9/9 and final source check PASS 46/46 remain recorded above. Owner review of the actual normal-data Dari interface is next; physical devices/printers remain unverified.

## Final entry-page browser acceptance - 2026-11-19

npm run test:auth:e2e PASS 18/18 in 1.7 minutes against guarded disposable fixtures. Covers public route isolation, login/CAPTCHA and all role login/logout scopes, offline session expiry, account lifecycle/revocation, notifications/sharing/print/report downloads, existing operational RTL/dark/theme/navigation/modal regressions plus new gallery/theme/manual slide/rotation/pause/image-failure cases. Logout test helper now opens the actual profile menu rather than targeting the removed historic direct-header button. No real credentials or records were changed. All three languages and mobile/desktop layouts passed.

Visually inspected .local/clothing-validation/home-desktop.png, .local/auth-validation/login-fa.png, login-light.png, login-dark.png and public-dark.png. Local photography displays correctly; dark/light forms, labels, CAPTCHA and actions remain readable. Sources and license are in frontend/public/images/bridal/CREDITS.md. Final npm run check and launcher readiness are recorded next. Next task: owner reviews imagery/copy and supplies public contact/address via the existing configuration when ready.
