# GitHub checkout

Clone https://github.com/MohammadMaiwand/MohammadYusuf_Tahirayn_project.git and run `npm ci` from the repository root. Real environment files, private Acount credentials, local MongoDB data and generated output are deliberately excluded from Git. Follow the local setup below to create your own configuration and authorized development accounts. Publishing source does not deploy the application or transfer local business records.

# Master Prompt 03 local authentication setup

After npm ci and npm run build, start the isolated development replica set with npm run db:dev. Run node scripts/database/setup-accounts.mjs to apply the explicit authentication migration and provision missing initial local accounts. The script preserves existing accounts/passwords, disables the development identity fixture and generates the offline signing pair when absent. Initial handoff is saved privately under Acount/LOGIN_DETAILS.txt. Restart using Launcher/START_SYSTEM.bat and use http://127.0.0.1:5173, with exact name/email/role/branch from the handoff and a fresh CAPTCHA. Admin has no branch field. Change initial passwords using Sessions & password. Do not run owner setup against production; its loopback-development guard is intentional.

See [AUTHENTICATION.md](AUTHENTICATION.md). Prior no-login/external-identity setup descriptions below are historical; opt-in identity fixtures are only for isolated development/testing.

# Installation and startup

Use Node >=24 (installed setup recommends Node 26 LTS) and npm >=11. Run npm ci in the root. Copy backend/.env.example and frontend/.env.example only when target files are absent; never overwrite existing settings or put secrets in VITE variables.

Business startup requires a MongoDB replica set. For this workspace run npm run db:dev, which uses the existing portable binary under .local/tools or MYT_MONGOD_PATH, preserves .local/mongodb/data and binds only 127.0.0.1:27018. The URI is mongodb://127.0.0.1:27018/myt_system?replicaSet=myt-dev. Alternatively use an authorized existing replica set/remote URI. A standalone service is insufficient for financial transactions.

For explicitly local demonstration only, set DEV_IDENTITY_ENABLED=true in backend/.env. No account is created; the fixture is loopback-development only. Fresh examples keep this false and therefore require a verified external identity and database grants for business access. Sync is optional: deliberately enable both OFFLINE_SYNC_ENABLED and VITE_OFFLINE_SYNC_ENABLED only when accepting the offline-data policy.

Set MONGODB_DEV_MANAGED=true to allow automatic startup of the exact isolated local development configuration, then double-click Launcher/START_SYSTEM.bat. It builds, checks ports/database and opens the default browser. STOP_SYSTEM.bat stops verified owned application servers; MongoDB data and service are preserved. npm run db:stop stops only the recognized isolated database. Existing configured service startup may need Windows permissions; remote connections never start local services.

npm run dev is the manual alternative. Default frontend http://127.0.0.1:5173; API http://127.0.0.1:4000/api/v1. The launcher is a development server; test offline on npm run test:e2e production preview, or deploy a built SPA behind reviewed HTTPS hosting.

Validation: npm run check (includes real MongoDB integration), npm run format:check; then npm run test:e2e. Do not run two builds against frontend/dist simultaneously. On Windows browser tests use installed Microsoft Edge; other platforms need Playwright Chromium. Hosted CI provisions its own disposable replica set. Test cleanup is restricted to uniquely generated test databases. See PROJECT_STATUS and VALIDATION_REPORT for actual executed results.
