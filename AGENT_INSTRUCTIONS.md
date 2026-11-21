# Agent instructions

Before editing, read this file, SYSTEM_MASTER.md, docs/PROJECT_STATUS.md, the module documentation, and the existing source. Verify documentation against code; a folder does not prove implementation. Master Prompt 02 authorizes business implementation phases A–J. Master Prompt 03 and the explicit owner request authorize login, secure sessions, user creation and initial owner accounts under Acount. This supersedes the earlier no-login/no-account restriction. Do not create operational Sham Shaban modules. A loopback-only, explicitly enabled development identity fixture is permitted; production must fail closed without verified identity and database grants.

After every task update status, changelog, relevant module docs, decisions and task tracker. Record dependencies, API/schema changes, actual tests, build results and unresolved errors. Never invent successful verification. Use Planned / Scaffolded / Implemented / Tested / Verified precisely. Preserve previous decisions; record superseding reasons rather than deleting history. Avoid rewriting working code and preserve data/backward compatibility.

All future business access requires verified identity, explicit active branch membership and service-level branchId filtering. Deny Sham Shaban. Test cross-branch access for every new operation. No raw client Mongo filters. No secrets or sensitive business data in logs or offline storage. Use reviewed migrations for database/index changes.

Run npm run check and npm run format:check after relevant code changes. Inspect package-lock.json for exact installed versions. The launcher is local development infrastructure, not production deployment. Update documentation before ending a session and state the exact next task.

After manifest, folder or master-reference changes, run `npm run docs:inventory` to regenerate the dependency inventory, source tree and docs/SYSTEM_MASTER_DOCUMENT.md mirror, then format those documents. Keep the root SYSTEM_MASTER.md canonical.

Master Prompt 03 current implementation is documented in docs/AUTHENTICATION.md. Use admin/manager/employee and cookie sessions; treat earlier external-identity/no-login documentation as historical. Preserve private Acount handoff and never print its secrets. Verify delegated effective role defaults and implied permissions, and keep online revocation/offline expiry checks independent of sync flags.
