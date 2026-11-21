# Temporary customer review link - 2026-11-20

The owner requested free hosting and a link for customer review, then asked the agent to arrange access without entering provider tokens. Render Free plus Atlas Free was researched as an independent-hosting option, but deployment was not performed: no account session/API credentials were accessible, the connector transport failed, and both computer-use interfaces reported that the native pipe was unavailable. This is an explicit temporary fallback, not an independent cloud deployment.

## Running preview

Public HTTPS URL: https://emma-collapse-poker-leader.trycloudflare.com

The existing cloudflared 2026.11.1 executable forwards only to the dedicated loopback static preview on port 4190, which proxies `/api` to the separate review API on 4010. A separate Vite production build is in `.local/client-review/dist`; the normal application configuration, production build and launcher processes were preserved. The review API uses production cookie behavior, a new signing key/secret, explicit public origin, disabled development identity and disabled write sync. No database port or local filesystem folder is exposed by the tunnel.

A new uniquely named `myt_review_*` database on the existing local replica set contains sample records for all four active branches. Existing migrations were applied explicitly only to that database. The existing guarded demo seeder used the new database and passed 121/121 checks (231 accepted sample commands). Nine new review-only accounts use separate strong random passwords and normal database grants. No real customer/account/password records were copied or reset. Sham Shaban remains disabled.

## Private handoff and lifecycle

- `Acount/CLIENT_REVIEW_CUSTOMER.txt`: one global administrator for the customer to inspect the sample system; share only this file's selected login privately.
- `Acount/CLIENT_REVIEW.txt` and `.json`: owner's full nine-account handoff. Never publish them.
- `.local/client-review/runtime.json`: private runtime configuration. Never publish it.
- `.local/client-review/processes.json`: PID/creation-time/script identities for only this preview.
- Stop with `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .local/client-review/stop.ps1`. It checks process identity before stopping; it does not stop the normal launcher or database and does not delete data.

The computer, MongoDB, review API, static preview, tunnel and internet must stay running. Cloudflare Quick Tunnels have no uptime guarantee, change hostname when recreated and are meant for testing. If restarted with another hostname, rebuild the isolated client and update the review API origin and private handoff. Stable independent hosting still requires authenticated access to the owner's provider accounts; no provider account, subscription or payment method was created or modified.

## Verification

Public homepage/login/readiness returned HTTP 200; anonymous session/customer API requests returned 401. Final real-HTTPS browser login, branch/cookie/logout and normal-app readiness results are recorded at the top of PROJECT_STATUS.md. Source is unchanged; the preceding full source/operational/authentication acceptance remains the baseline. This task does not claim independent-hosting or production financial readiness.

Sources: [Render free limits](https://render.com/docs/free), [Atlas free cluster limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/), [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).
