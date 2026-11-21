# Mohammad Yousuf Taherian Trading Company Management System

MERN workspace with branch-scoped business implementation and a Windows development launcher. Master Prompt 03 authentication, account management and role/branch authorization are implemented. Sham Shaban stays disabled. Commercial deployment remains subject to the controls and acceptance tasks in [project status](docs/PROJECT_STATUS.md).

On this configured machine, double-click **Launcher/START_SYSTEM.bat** to build and open the application. Use **Launcher/STOP_SYSTEM.bat** to stop its application servers. The explicitly enabled isolated development database uses .local/mongodb/data; existing Windows-service data is preserved.

Fresh setup and optional local identity fixture: [installation](docs/INSTALLATION_GUIDE.md). Verify using npm run check, npm run format:check and npm run test:e2e (local replica set required). Read [SYSTEM_MASTER.md](SYSTEM_MASTER.md) before modifying source.

Authentication architecture and current limitations: [AUTHENTICATION.md](docs/AUTHENTICATION.md). Initial owner-authorized local login details are in the private ignored Acount/LOGIN_DETAILS.txt; do not publish those files.
# MohammadYusuf_Tahirayn_project
