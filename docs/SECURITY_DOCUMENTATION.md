# Master Prompt 03 security ? current record

Authentication is implemented; previous no-account/no-login statements below are historical. Passwords use Argon2id (64 MiB, three iterations, parallelism one). Access secrets expire after 15 minutes, refresh sessions after seven days, with hashed storage, rotation/reuse revocation and HttpOnly SameSite=Strict cookies (Secure in production). Requests require an allowed Origin when supplied and a custom header on cookie/auth mutations. CAPTCHA is HMAC-signed, expires after two minutes and is consumed atomically. Generic login errors avoid account enumeration. Persistent IP/email attempts, account lockout and process rate limits mitigate brute force.

Grant/status/branch changes and password resets revoke target sessions. Managers cannot elevate employee defaults or expanded catalog permissions beyond their own effective delegable authority. Global session management additionally requires sessions.manage; all users retain management of their own sessions. A 15-second check refreshes identity independently of offline sync and locks expired offline leases. See [architecture, threat limits and policy](AUTHENTICATION.md). Owner handoff files contain initial secrets by explicit request, are ignored by source control, and must remain private.

# Current implementation ? 2026-11-13 (Asia/Kabul)

Current source exposes permission-protected business APIs with database-loaded user grants, active branch scope, device validation, transactional idempotency and audit records. Explicit local development identity is restricted to loopback development; no accounts or login UI are created. Rate limiting remains 120/minute/IP by default, with validated RATE_LIMIT_MAX and structured 429 responses. Browser tests use a higher explicit limit on temporary local test servers.

The business cache now uses AES-GCM IndexedDB storage, including a stored nonextractable key. This is not protection against same-origin compromise or physical access to an unlocked profile. Retention, cache purge/revocation offline, external identity integration, migrations, TLS and tested backup/restore remain deployment blockers. Earlier claims of no business APIs or metadata-only storage are historical.

Dependency audit evidence below is from 2026-11-12 unless a later executed result appears in PROJECT_STATUS; no new upstream security claim is made in this update.

---

## Historical Phase 1 record ? superseded where contradicted above

# Security foundation

Implemented controls: strict environment validation, Mongo URI format check, no committed secrets, loopback default binding, Helmet defaults, explicit CORS origins, 100kb JSON limit, 120 requests/minute/IP in-process limiter, request IDs, safe error envelopes, and sanitized request logging. Authorization/cookies/query strings and request bodies are not serialized into logs. Database startup errors do not print connection strings. Launcher configuration output omits URI and JWT secret. Logs and runtime state are Git-ignored.

JWT verification exists without an issuer/login endpoint. Argon2 is installed for future password hashing; there are no password models or default accounts. Disabled branch access is rejected even if a principal lists it. No business API is exposed, and helpers do not claim to enforce isolation for code that bypasses them.

Planned before deployment: validated identity source, MFA decision, password policy and Argon2 tuning, token rotation/revocation, CSRF controls based on chosen transport, server-side grant loading, audit trail, dependency updates, TLS, secure hosting headers, backups, least-privilege database credentials, encrypted disks and retention policy. Set Express trust proxy only for a known proxy topology; current app does not trust forwarded IPs. Multi-instance deployments need a shared limiter store. Browser IndexedDB is not encrypted by this scaffold and must not contain sensitive data.

Do not label this phase production-approved. Integration, threat modeling, restore testing and operational controls remain pending.

## Dependency audit evidence

Runtime-only npm audit reports zero advisories. The full tree reports four low findings originating in [deepmerge prototype poisoning](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), propagated through @rollup/plugin-node-resolve, workbox-build and vite-plugin-pwa. This is build tooling, not an API runtime dependency. The compatible upstream chain still includes deepmerge 4.3.1; no compatible patched release was available. npm suggests an incompatible old PWA plugin downgrade; it was not applied. Track an upstream update before production approval.

Initial critical test-tool findings were removed with Vitest 5.1.0. Glob/minimatch findings were removed with root overrides for glob ^14.0.6 and minimatch ^11.0.5 (locked 14.0.6 / 11.0.8). Lint, tests and PWA generation passed with those overrides. Reassess/remove them when upstream requirements adopt patched versions. Audit results do not constitute a complete security assessment.
