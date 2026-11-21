# Windows development launcher

Double-click START_SYSTEM.bat; use STOP_SYSTEM.bat to stop. Requires Windows 10/11, PowerShell 5.1+, Node >=24, npm/dependencies and configured environments. Logs are in Launcher/.runtime. Startup builds, validates configuration, checks ports, probes MongoDB, starts backend/frontend, waits for readiness and opens the default browser. Duplicate startup is blocked. STOP verifies PID, creation time and script path before stopping an application process.

Business startup requires a MongoDB replica set. Explicit MONGODB_DEV_MANAGED=true permits automatic startup only in development for 127.0.0.1:27018 with replicaSet=myt-dev. The workspace helper checks the database path and replica-set identity and preserves .local/mongodb/data. Existing installed/portable mongod or MYT_MONGOD_PATH is required. Other local settings use only the named existing Windows service; remote URIs are only probed. STOP never stops MongoDB; npm run db:stop stops only the recognized isolated development instance without deleting data.

The local environment already enables development identity and isolated database management. No account is created. Fresh examples default identity, management and sync to false; follow docs/INSTALLATION_GUIDE.md to opt in deliberately. Environments are never overwritten by the launcher. This is development infrastructure, not production hosting. Vite development mode does not establish PWA offline acceptance; browser tests use a production build.

Actual lifecycle verification results are in docs/VALIDATION_REPORT.md. Preserve historical decisions in docs/DECISIONS_LOG.md.

Windows lifecycle correction (2026-11-13): Start-Process -Wait follows descendants, so the detached mongod caused the launcher to wait indefinitely after the helper reported readiness. WaitForExit now waits only for the helper process. The stalled test launcher was identified and stopped without stopping unrelated applications; the isolated database was shut down through its verified helper before retesting.
