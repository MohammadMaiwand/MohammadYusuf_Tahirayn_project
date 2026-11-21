# Authentication environment additions

JWT_SECRET (minimum 32 characters) signs CAPTCHA, not access JWTs. AUTH_PRIVATE_KEY is the private Ed25519 PKCS8 DER key encoded as base64; never expose it to VITE. VITE_AUTH_PUBLIC_KEY is the matching public SPKI DER base64 key for bounded offline leases. The owner setup script creates the pair locally if absent. DEV_IDENTITY_ENABLED must be false for actual account login and production. Use matching loopback hostnames for frontend/API cookies; the local handoff URL is http://127.0.0.1:5173. Production requires same-site HTTPS, Secure cookies and an explicitly allowed CORS origin.

# Current implementation ? 2026-11-13 (Asia/Kabul)

Current additions: DEV_IDENTITY_ENABLED (false by default), DEV_ROLE (admin/manager/user), DEV_BRANCH_ID (active branch only), RATE_LIMIT_MAX (1..10000; default 120/minute/IP) and launcher-only MONGODB_DEV_MANAGED (false by default). Development identity is explicitly enabled only for loopback development; production rejects it.

The example MongoDB URI now targets mongodb://127.0.0.1:27018/myt_system?replicaSet=myt-dev. The business bootstrap requires a replica set. Enable MONGODB_DEV_MANAGED=true only to permit the launcher to start the workspace-isolated local database at this exact host/port/replica-set combination. Otherwise configure an authorized existing replica set/remote URI. Existing environment values were preserved; the managed-database opt-in was appended to the already configured local development environment. Sync flags are functional and stay false in fresh examples until intentionally enabled.

---

## Historical Phase 1 record ? superseded where contradicted above

# Environment reference

Examples contain no operational secrets. Backend is the only consumer of MongoDB and JWT settings. During Phase 1 setup, ignored backend/.env and frontend/.env files were created only because they did not exist; the local backend uses localhost MongoDB and the discovered MongoDB service name. No existing environment file was overwritten. The launcher itself never creates or overwrites environment files.

| Setting                     | Purpose / default                                                  |
| --------------------------- | ------------------------------------------------------------------ |
| MONGODB_URI                 | Required backend MongoDB connection; local example only            |
| PORT / HOST                 | API 4000 / 127.0.0.1; validate port range                          |
| FRONTEND_URL                | Local launcher browser URL, default http://localhost:5173          |
| CORS_ORIGINS                | Comma-separated exact origins; no wildcard                         |
| NODE_ENV                    | development, test or production                                    |
| LOG_LEVEL                   | info default; allowed Pino levels                                  |
| JWT_SECRET                  | Optional until authentication enabled; >=32 characters; never VITE |
| JWT_ISSUER / JWT_AUDIENCE   | Future token verification identity                                 |
| OFFLINE_SYNC_ENABLED        | Must remain false in Phase 1                                       |
| APP_TIMEZONE / APP_CALENDAR | Fixed Asia/Kabul / persian                                         |
| MONGODB_SERVICE_NAME        | Optional launcher-only existing local service name                 |
| VITE_API_URL                | Public frontend API URL; default local /api/v1                     |
| VITE_OFFLINE_SYNC_ENABLED   | Must remain false; no sync engine                                  |
