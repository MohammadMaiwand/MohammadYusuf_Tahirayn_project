# Premium interface architecture - 2026-11-13

main.tsx loads base/auth CSS followed by the shared screen-only premium theme and canonical print CSS. OperationalApp.tsx retains the authenticated role/branch shell with persisted sidebar collapse and a keyboard-accessible mobile drawer/profile menu. DashboardPage.tsx composes role views; DashboardWidgets.tsx provides real-data metrics, payment/category charts, welcome, quick actions, notifications and date badges. Local premium translations and a reduced-motion hook are shared. Existing APIs/business rules are unchanged. See [UI_DESIGN.md](UI_DESIGN.md).

# Master Prompt 03 architecture ? superseding record

The application now starts with a real localized login page. Express resolves opaque cookie sessions and reloads account status and grants from MongoDB for each request. Existing branch services remain the data isolation boundary. Admin, manager and employee receive different dashboards. Authentication, account/session management, persisted branch messages, notification polling and reviewed WhatsApp links integrate into the existing shell. See [AUTHENTICATION.md](AUTHENTICATION.md). Earlier no-login/external-identity statements below are superseded.

# Current implementation ? 2026-11-13 (Asia/Kabul)

The existing source now contains business implementation beyond the original Phase 1 snapshot, authorized by repository guidance referencing Master Prompt 02. React has lazy business routes, query cache, persistent language preference, branch selection, catalog/customer/transaction/payment screens, reports, notifications, settings, existing-user grants, invoices and sync conflict review. No login screen or account creation is included.

Express mounts identity-resolved branch routers; commands perform service-level predicates, device checks and MongoDB transactions. Bootstrap requires a replica set. A periodic job reconciles notifications. Shared schemas and integer-minor-unit money functions define contracts. The local launcher remains development infrastructure; commercial deployment needs reviewed migrations, external verified identity, TLS, backup/restore, retention and threat review.

---

## Historical Phase 1 record ? superseded where contradicted above

# System architecture

Phase 1 is a foundation, not a finished commercial system. npm workspaces provide frontend, backend, and a compiled ESM shared package. Build shared before its consumers. The repository root is the requested project directory; no extra nested project directory was introduced.

React uses a BrowserRouter, TanStack Query provider, Zustand language preference, and i18next resources. The only screen is a responsive foundation status page. Branch cards display configuration; they do not select a working business module. Tailwind 4 uses its Vite plugin rather than a legacy PostCSS configuration. React Hook Form, Zod resolver, Recharts and date-fns are installed for later phases without example business UI.

Express 5 uses versioned routes, Helmet, an explicit CORS allowlist, bounded JSON payloads, per-process rate limiting, request IDs, redacted structured logs, and centralized error responses. Server startup validates environment and connects MongoDB before listening. Shutdown closes HTTP and database connections with a 10-second deadline.

Shared configuration declares three active branch IDs and one disabled planned ID. No operational business models or routes exist. `authorizeBranch` checks a verified principal and active membership. `scopedIdentity` demonstrates an immutable authorized branch in service queries. These utilities must be connected to every future service before business endpoints exist. Types alone are not an authorization boundary.

Production deployment remains planned: HTTPS reverse proxy, process supervision, backups and restore exercises, distributed rate limiting, monitoring, CSP validation, vulnerability review, and authenticated integration tests. Local launcher is not production hosting.
