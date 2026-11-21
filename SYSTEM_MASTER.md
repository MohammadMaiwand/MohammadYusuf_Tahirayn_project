# Phase 2 garment alterations - 2026-11-20

The owner's Phase 2 brief authorizes [Garment alterations](docs/GARMENT_ALTERATIONS.md): one branch-scoped module, customer tabs and transaction integration; manual garment IDs; immutable original price/currency and separate booked service charges; secure reused photos; authorized receipts; own/branch granular permissions; and automatic durable management reminders on the prior Kabul day. The existing server timer also marks overdue work and repairs rescheduled/completed reminders. Additive explicit migration: scripts/database/migrate-alterations.mjs. No legacy financial/credential/invoice replacement or operational Sham Shaban. Executed local acceptance and next task: docs/PROJECT_STATUS.md.

# Phase 1 record currency and customer improvements - 2026-11-20

The owner's new [Phase 1 brief implementation](docs/PHASE1_FINANCIAL_IMPROVEMENTS.md) supersedes earlier branch-fixed monetary record rules: all four active branches support per-record AFN/USD selection, matching-currency payments/packages, separate balances/reports/company charts and original-price currency snapshots. Historical metadata migration is explicit and additive; numeric amounts and existing invoice snapshots are preserved. Today is accepted by Kabul calendar day; genuine historical backdate grants remain. Customer filters and per-row bills reuse existing query/print authorization. No new technology/dependency, payroll module or operational Sham Shaban capability. Executed results and next task: docs/PROJECT_STATUS.md.

# Premium interface redesign - 2026-11-13

Current enterprise UI expansion (2026-11-19): [Enterprise experience](docs/ENTERPRISE_UI.md) records the supplied complete redesign brief, audit, route coverage and interaction contracts. The existing screen system now adds persistent light/dark themes, sidebar/top navigation modes, shared permission-filtered accordion/dropdowns, a keyboard page finder, notification previews, presentation preferences and portalled large-form workspaces with a single scroll region. Backend contracts, branch scope and print geometry remain unchanged. Current executed evidence belongs in PROJECT_STATUS.md.

The owner's supplied Premium Manager Dashboard brief is applied across the entire system by explicit request. Shared screen styling, collapsible desktop/mobile navigation, profile menu, role dashboards, real-data Recharts visualizations, localized quick actions and reduced-motion behavior are documented in [UI_DESIGN.md](docs/UI_DESIGN.md). No backend API/schema/business-rule or permission change is part of this redesign. Print geometry remains isolated from screen-only theme rules. Current test and visual evidence is recorded in PROJECT_STATUS.md.

# Master Prompt 03 ? current authentication architecture (2026-11-13)

Master Prompt 03 supersedes the historical no-login/no-account and external-identity-only statements below. Local authentication now uses MongoDB accounts, Argon2id passwords, opaque HttpOnly cookie sessions, rotating refresh credentials, signed single-use CAPTCHA, database-loaded permissions and three operational roles: admin, manager, employee. Admin has global active-branch scope; other roles have exactly one active branch. Sham Shaban remains unauthorized and disabled. The previous bearer integration is no longer the active business identity resolver.

See [authentication architecture and acceptance](docs/AUTHENTICATION.md). Owner-authorized initial local credentials are handed off exclusively in the ignored private Acount folder. Existing business records are preserved. This is local implementation, not approval for public financial deployment. Current verification is recorded at the top of PROJECT_STATUS.md; older results below are retained as historical evidence.

# Mohammad Yousuf Taherian Trading Company Management System

Canonical technical reference. Reviewed 2026-11-18 (Asia/Kabul). Read AGENT_INSTRUCTIONS.md and docs/PROJECT_STATUS.md before changes. Master Prompt 02 authorizes implementation A-J; Master Prompt 03 authorizes login, account creation and private owner handoff. Operational Sham Shaban remains unauthorized. Earlier decisions are retained as history and superseded where noted.

## Scope and evidence

The existing repository contains business implementation beyond its original foundation: branch-scoped catalog, customers, purchase/rental transactions, payments/reversals, delivery, invoice snapshots/printing, notifications, reports, settings, existing-user grants, audit and offline synchronization. This session preserved those features and completed verification/setup fixes. Implemented means source exists; Tested names executed checks; Verified applies only to the stated local environment. This is not production deployment approval. Current results and limitations: [status](docs/PROJECT_STATUS.md) and [validation](docs/VALIDATION_REPORT.md).

## Stack, layout and dependencies

React 19, TypeScript, Vite, Tailwind 4, React Router, Zustand, TanStack Query, React Hook Form/Zod, i18next, date-fns/jalaali-js, Lucide, Recharts, Workbox/PWA and Dexie. Node/Express 5, Mongoose/MongoDB replica set, cookie sessions, Argon2id passwords, signed offline leases, retained jose verification utilities, Helmet/CORS/rate limiting/Pino. Vitest/Supertest, Playwright, ESLint/Prettier and strict TypeScript. Exact locked versions: [dependencies](docs/DEPENDENCIES.md); installed resolutions live in package-lock.json. No new dependency was added in this completion session.

[Generated folder inventory](docs/FOLDER_STRUCTURE.md) describes the workspace. frontend/src/app/OperationalApp.tsx owns the shell and lazy business routes; features/ owns pages; services/api.ts handles identity/API/cache; offline/ owns encrypted vault/outbox; i18n/ and styles/ handle localization, layout and print. backend/src/app.ts creates HTTP; server.ts connects/bootstrap/jobs; routes/business.ts exposes contracts; security/identity.ts resolves grants; services/commands.ts applies transactional operations; modules/ owns domain services; database/models.ts defines schemas and bootstrap.ts creates collections/indexes/default configuration. shared/ contains branches, permissions, schemas and exact money arithmetic. Launcher/ owns Windows lifecycle; scripts/ contains local database and maintenance tools.

## Branches, identity and permissions

Four active branches: sham-royal, sham-aroos, sham-aroos-vip and dollar. sham-shaban remains disabled and is never seeded. Every business operation requires active membership, permission and service-level branch predicates. Opaque cookie sessions resolve current database account status and grants; commands refresh grants. Roles are admin, manager and employee with explicit allow/deny overrides. Initial local accounts use private Acount handoff. A deliberately enabled development identity is restricted to development loopback; missing verified identity fails closed. [Authentication](docs/AUTHENTICATION.md), [permissions](docs/PERMISSIONS_DOCUMENTATION.md), [security](docs/SECURITY_DOCUMENTATION.md).

## Data, API and financial rules

MongoDB must support transactions (replica set or mongos). Registered collections, relations and compound indexes: [database](docs/DATABASE_SCHEMA.md). Bootstrap creates active branches, configuration, permissions/roles and guarantee defaults; initial accounts use a separate authorized setup script. Explicit additive migrations cover auth, clothing, expenses and operations. Startup index management still requires production review. No raw client Mongo filters. [API](docs/API_DOCUMENTATION.md) maps public health/readiness, authenticated session and branch-scoped resources, commands, reports and sync. Strict shared schemas validate input; writes use device identity, idempotency request hashes and optimistic version checks.

Amounts use integer minor units after strict decimal parsing: Dollar uses USD, other active branches AFN. Company totals are separated by currency; exchange conversion is not implemented. Transactions snapshot catalog prices; payments change balance once, include advances and preserve reversal history. Invoices store immutable snapshots. Paired A4 copies are the default, with paired continuation pages and optional A5. Owner fiscal-policy and physical-printer acceptance remain pending. See [operations](docs/OPERATIONS_COMPLETION.md) and [printing](docs/PRINTING_DOCUMENTATION.md).

## Offline, language and calendar

Workbox precaches built static assets and excludes API navigation fallback. Dexie AES-GCM vault stores scoped session/business cache and command queue; its key is stored in the browser. This is not protection against same-origin compromise or unlocked device access. Both sync flags must be deliberately enabled; examples default false. Server replay reauthorizes and detects conflicts; users explicitly review financial conflicts. [Offline design and limitations](docs/OFFLINE_SYNC_DOCUMENTATION.md).

English is LTR, Dari and Pashto RTL; language preference persists and root lang/dir change. Dates display in Persian calendar, Asia/Kabul; store instants in UTC and preserve explicit date-only semantics. Nowruz and Kabul-midnight tests exist. Native-language/calendar-label review remains pending.

## Installation, launcher and quality

[Installation](docs/INSTALLATION_GUIDE.md), [environment](docs/ENVIRONMENT.md), [launcher](Launcher/README.md). npm ci installs the locked workspaces. Do not overwrite environments or expose secrets in VITE variables. npm run db:dev starts the isolated development replica set on 127.0.0.1:27018 using .local/mongodb/data. MONGODB_DEV_MANAGED=true explicitly permits launcher startup of this exact development configuration; other URIs only use existing configured services or remote connections. Launcher builds, probes, checks ports, starts owned servers and opens the default browser. STOP verifies process identity and never deletes database data. The launcher serves development mode; PWA acceptance uses production preview.

Run npm run check and npm run format:check. Database integration tests require a local replica set and create guarded unique disposable databases. npm run test:e2e builds and runs Edge (Windows) or Chromium browser acceptance, including printing, languages/mobile, offline replay and conflicts. Do not run builds concurrently with browser tests against the same dist folder. CI now provisions a disposable replica set; hosted execution is not claimed. Run npm run docs:inventory after manifests/folders/master changes and format generated documents.

## Remaining deployment work

Production account provisioning policy, database/index migration review, operational TLS/hosting, backup/restore tooling and exercises, offline retention/recovery/key rotation, physical devices/PWA installation, physical printing and native-language acceptance remain required. Automatic external messaging, independent partial delivery and existing-order product replacement are not implemented; see [operations limits](docs/OPERATIONS_COMPLETION.md). Audit history and upstream warnings are recorded in security/status docs. Passing local tests never establishes zero defects or production readiness. [Roadmap](docs/DEVELOPMENT_ROADMAP.md), [task tracker](docs/TASK_TRACKER.md), [changelog](docs/CHANGELOG.md).

## Branch expenses - 2026-11-13

[Expenses module](docs/EXPENSES.md) adds six-field, branch-isolated expense entry and tables to all three active branches. Positive AFN minor units, Jalali display, direct online-only API access, transactional idempotency and explicit read/create permissions apply. The new collection/indexes are managed by an additive explicit migration, not startup bootstrap. No edit/delete or net-profit/cash-account integration is included. Sham Shaban remains disabled.

## Operations completion - 2026-11-18

See [operations completion](docs/OPERATIONS_COMPLETION.md) for current implementation, additive migration, currency rules, atomic registration, account history, transaction corrections, paired continuation printing and explicit limitations. This supersedes the older three-active-branch/AFN-only/print-default descriptions. Verification is recorded in PROJECT_STATUS.md.
