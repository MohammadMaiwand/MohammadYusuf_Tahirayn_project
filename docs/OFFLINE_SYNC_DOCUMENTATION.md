# Local login without internet - 2026-11-21

Fixed the normal local login pointing at an obsolete temporary Cloudflare API override. Restored the ignored frontend/.env.local API URL to loopback. frontend/src/lib/env.ts now routes development pages opened on localhost/127.0.0.1 through the existing same-origin Vite /api proxy, preventing a leftover tunnel override from breaking local CAPTCHA/login. Public tunnel hosts and production builds retain their explicitly configured API URL. The local backend and MongoDB must remain running; internet is unnecessary for local authentication. Existing signed-lease rules still apply when the backend itself is unavailable.

No dependency, schema, migration, password, grant or business-record change. Existing launcher-owned servers were restarted using the normal launcher; separate review hosting was untouched. Exact locked versions inspected: Vite 7.3.8 and Vitest 5.1.0. Required npm run check PASS: 66/66 tests, types, lint, builds, structure and PWA checks. Initial sandbox test attempt hit esbuild spawn EPERM; approved rerun passed. Existing upstream annotation/bundle warnings remain. Actual Edge verification blocked all external HTTP requests: admin/manager/employee CAPTCHA, login, dashboard, reload and logout PASS. No credentials printed. Next task: owner reloads the local login and confirms use with internet disconnected while the local launcher stays running.

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

# Master Prompt 03 offline authorization policy

A real online login is required before offline access. The server signs an eight-hour maximum authorization lease using Ed25519, bound to user, device, branch scope, effective permissions and expiry. The frontend must have the matching public key and verifies signatures before restoring a cached session. No offline account creation, password reset or permission escalation is available. Cached data and queued commands remain isolated by subject/branch/device/permission digest. A 15-second identity check runs even if sync is disabled; reconnect reloads account status and grants, while replay independently reauthorizes commands.

Logout removes the cached lease and clears in-memory queries; encrypted business cache/outbox remains scoped for recovery and cannot be reopened through the application without a valid lease. Immediate remote revocation while disconnected is impossible. Browser keys and clock/profile control do not provide tamper-proof protection against an attacker controlling the same origin/device. Disk encryption, managed devices and operational cache retention/recovery remain deployment responsibilities. See [AUTHENTICATION.md](AUTHENTICATION.md).

# Current implementation ? 2026-11-13 (Asia/Kabul)

Implemented static Workbox precache plus an AES-GCM Dexie vault, scoped by identity, branch, device and permission digest. The nonextractable encryption key is stored in IndexedDB; encryption does not protect against malicious same-origin code or an unlocked browser profile. Session snapshots, cached business responses and command outbox exist. Sensitive-data retention and device recovery require review before commercial use.

The outbox implements pending/synchronizing/synced/failed/conflict/superseded states, retries and explicit conflict review. Server replay rechecks membership, permissions and device state; operations use transactional request-hash idempotency. Offline payments also require branch policy and a limit. Both OFFLINE_SYNC_ENABLED and VITE_OFFLINE_SYNC_ENABLED must be deliberately enabled for these tests; fresh examples remain disabled. The launcher serves Vite development mode; production service-worker acceptance uses npm run test:e2e and the built preview.

Browser acceptance evidence and outstanding checks are recorded in PROJECT_STATUS.md. PWA desktop installation, physical devices, long disconnections, storage eviction and key recovery remain separate acceptance tasks.

---

## Historical Phase 1 record ? superseded where contradicted above

# Offline and synchronization

Scaffolded: Vite PWA/Workbox generates a service worker during production build. Static app assets are precached; `/api/` paths are excluded from navigation fallback, and no API runtime cache is configured. Manifest and locally generated PNG icons are provided. Production assets work offline only after a successful online visit and service-worker installation. Development launcher does not enable production offline behavior. Offline browser acceptance testing is pending.

Dexie defines a version-1 metadata-only IndexedDB store with a key primary index. The database is not opened automatically and contains no business records, credentials or sync queue. Sync is explicitly disabled by validated backend/frontend environment settings. No offline financial operation or reliable synchronization is implemented.

Planned: authenticated user/device and branch partitions; idempotency keys; server-authoritative revision checks; outbox with retry/backoff; tombstones; stable ordering/cursors; schema migrations; per-operation reauthorization; explicit user conflict resolution; transactional server application with unique operation indexes; visible pending/error status. Financial conflicts must never use silent last-write-wins. Clear user caches at logout once identity is implemented. Validate offline retention, quota errors, clock skew and reconnect behavior before enabling writes.

2026-11-13 offline regression fix: TanStack Query previously paused mutations and uncached reads before the application outbox/cache handlers could execute. useSave mutations and query defaults now use networkMode:always, allowing the existing handlers to decide between server and local storage. Browser tests exercise customer/transaction/payment creation, reload, reconnect and explicit cross-device conflict review. No authorization checks were removed. ESLint/Prettier now exclude generated .local browser reports; mobile screenshots wait for drawer animation completion.

## Expenses addition - 2026-11-13

Expenses are online-only; ExpensesPage uses direct requests with in-memory query state and no IndexedDB cache/outbox. expense.create is not allowed for offline replay.
