# Advertisement management scope - 2026-11-20

The owner authorized the manager role to use the same advertisement tools as admin. `advertisements.manage` is granted by default to admin and manager, but not employee. Admins manage company-wide and branch advertisements; managers can list, create, edit, delete and upload images only for advertisements assigned to their single active branch. The server derives that branch from the verified session and filters every manager read/write; client-submitted scope is not trusted. Employee access is denied even if an invalid explicit grant is present. The management page and route remain permission-gated.

Existing advertisements remain company-wide (`branchId: null`) and unchanged. New manager-created ads and their uploaded images are tagged to the manager's assigned branch. The unauthenticated public list continues to expose only active, in-window banners (including branch banners) and their image references. The public image response allows cross-origin embedding because the frontend and API use separate local origins; all other Helmet resource policies remain unchanged. The explicit rerunnable migration adds nullable branch metadata, a manager-scope index and the manager default grant. See [AUTHENTICATION.md](AUTHENTICATION.md).

# Phase 2 garment alteration integration - 2026-11-20

[Garment alterations](GARMENT_ALTERATIONS.md) documents the new branch-scoped ledger/model, shared strict commands, list/detail/tailor/receipt/photo endpoints, permission defaults and overrides, separate per-currency booked service charges, localized print surface and durable management-only reminders. Additive explicit migration: scripts/database/migrate-alterations.mjs. Existing records, payments, original purchase prices, invoices and credential handoff remain preserved. Actual executed tests and delivery readiness are in PROJECT_STATUS.md.

# Current role and permission matrix ? Master Prompt 03

The only operational identifiers are admin, manager and employee; legacy user is migrated to employee. shared/constants/permissions.ts defines the exact granular matrix (catalog resource create/update, customers, transactions, payments/reversals, invoices, reports/exports, expenses, notifications/messages, account lifecycle, assignment, sessions, security and offline sync). GET /roles exposes defaults and GET /permissions exposes the caller's delegation choices. The account editor groups translated checkbox grants and supports select all, deselect all, category collapse, confirmation and cancel.

Admin: all active branches and default permissions, subject to explicit deny. Manager: exactly one branch, branch operations and management of that branch's employees; no global/security/session administration or manager/admin creation. Employee: exactly one branch, routine customer/transaction/payment/invoice/notification/message operations, own transactions by default; no administrative escalation. Deny wins. Managers must hold every effective permission delegated, including defaults and catalog.write expansion. Branch/role client selections never confer authority. See [AUTHENTICATION.md](AUTHENTICATION.md). Historical matrices below are superseded.

# Current implementation ? 2026-11-13 (Asia/Kabul)

Implemented roles are admin, manager and user; shared/constants/permissions.ts is authoritative for action permissions and role defaults. Server identity resolution verifies a bearer token then loads an enabled User and active branch memberships from MongoDB, applying allow/deny overrides. Commands refresh grants before execution. No login UI, issuer or default accounts exist.

An explicit DEV_IDENTITY_ENABLED=true fixture is allowed only in development bound to loopback and for local requests. DEV_ROLE defaults to admin; DEV_BRANCH_ID applies to non-admin fixtures. This fixture is not a production identity source. Production identity provisioning and account lifecycle remain external/pending. The user-management route changes existing grants; it does not create accounts. Cross-branch records and disabled Sham Shaban remain denied.

---

## Historical Phase 1 record ? superseded where contradicted above

# Roles and permissions — proposed, not implemented

| Proposed role        | Intended scope                                                |
| -------------------- | ------------------------------------------------------------- |
| System administrator | User/grant configuration; no implicit financial bypass        |
| Company manager      | Explicitly granted branch reports and approvals               |
| Branch manager       | Assigned branch operations and approvals                      |
| Accountant           | Assigned branch financial operations within permission limits |
| Operator             | Assigned branch routine entry, no administrative grants       |
| Auditor              | Explicit read-only assigned branch access                     |

These roles require owner confirmation before implementation. No users, role model, permission middleware or role endpoints exist. Existing branch helper denies anonymous, inactive and ungranted branch access. Future permissions require action + resource + branch checks, least privilege, server-managed grants, audit logging and authorization tests. UI visibility does not grant access. Disabled Sham Shaban is never operational.

## Expenses addition - 2026-11-13

expenses.read and expenses.create are default role grants for admin/manager/user, always restricted by active branch memberships and user deny overrides. No global or disabled-branch expense access is introduced.

## Operations completion - 2026-11-18

See [operations completion](OPERATIONS_COMPLETION.md) for current implementation, additive migration, currency rules, atomic registration, account history, transaction corrections, paired continuation printing and explicit limitations. This supersedes the older three-active-branch/AFN-only/print-default descriptions. Verification is recorded in PROJECT_STATUS.md.
