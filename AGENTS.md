# PRism Backend Agent Guide

## Project Purpose
PRism backend provides a permission-first, auditable PR and release management API for internal engineering teams. It replaces spreadsheet-based PR tracking with structured lifecycle management, release grouping, release note generation, and governance controls.

## Authoritative Sources
- `../PRism_Detailed_BRD.docx`
- `../PRism_Detailed_Technical_Architecture_Document.docx`

When documents differ:
- Use the BRD for business intent.
- Use the Technical Architecture document for implementation details.

## Mandatory Engineering Rules
- Enforce authorization by permission keys only (for example `CAN_CREATE_PR`), never by role names.
- Every protected route must pass auth + permission middleware before controller logic executes.
- Keep `audit_logs` immutable in application behavior (append only; no update/delete flows).
- Validate PR and release lifecycle transitions before persistence.
- Follow login gates in order: domain validation -> OTP -> user status checks.
- On profile email or GitHub changes, set user status to `PENDING_VERIFICATION` and notify verifiers.
- Persist delivery outcomes for notifications (`SENT` or `FAILED`) in `notification_logs`.
- Add purposeful Winston logs for key state changes, security decisions, and failures.

## Backend Domain Model Snapshot
- `users`: identity, status, profile fields.
- `roles`: named role containers.
- `permissions`: canonical `CAN_*` keys.
- `role_permissions`: role to permission mapping.
- `user_roles`: user to role mapping.
- `email_domains`: allowed login domains and status.
- `otp_tokens`: one-time login verification tokens.
- `prs`: PR metadata, ownership, reviewer, status, type.
- `releases`: release container per environment (`STAGING`, `PRODUCTION`, `UAT`).
- `release_pr_map`: many-to-many mapping between releases and PRs.
- `audit_logs`: immutable action ledger with metadata.
- `notification_logs`: notification delivery records.

## API Guardrails
All endpoints below require auth unless explicitly public by design:

- Auth: `POST /auth/request-otp`, `POST /auth/verify-otp`, `POST /auth/logout`
- Profile: `GET /profile`, `PUT /profile`
- Users:
  - `CAN_CREATE_USER`: `POST /users`, `GET /users`, `GET /users?status=pending_verification`
  - `CAN_VERIFY_USERS`: `POST /users/:id/approve`, `POST /users/:id/disapprove`
  - `CAN_ASSIGN_ROLE`: `POST /users/:id/roles`, `DELETE /users/:id/roles/:roleId`
- Roles:
  - `CAN_MANAGE_ROLES`: `POST /roles`, `GET /roles`, `PUT /roles/:id`, `DELETE /roles/:id`
  - `CAN_MANAGE_PERMISSIONS`: `POST /roles/:id/permissions`, `DELETE /roles/:id/permissions/:permissionId`
- Email domains (`CAN_MANAGE_EMAIL_DOMAIN`):
  - `GET /email-domains`, `POST /email-domains`, `DELETE /email-domains/:id`, `PATCH /email-domains/:id/status`
- PRs:
  - `CAN_CREATE_PR`: `POST /prs`
  - `GET /prs`: if `CAN_VIEW_ALL_PRS` return all, otherwise owner-scoped results only
  - `CAN_REVIEW_PR`: `PATCH /prs/:id/status`
  - `CAN_ASSIGN_PR`: `PATCH /prs/:id/assign`
- Releases:
  - `CAN_MANAGE_RELEASE`: `POST /releases`, `GET /releases`, `POST /releases/:id/add-pr`, `DELETE /releases/:id/remove-pr`
  - `CAN_SET_PROD_RELEASE_DATE`: `PATCH /releases/:id/date`
- Release notes:
  - `CAN_GENERATE_OWN_RELEASE_NOTES`: `GET /release-notes/my`
  - `CAN_GENERATE_FULL_RELEASE_NOTES`: `GET /release-notes/:releaseId`

## Working Workflow for Agents
Before coding:
- Map requirement -> route -> permission key -> entities touched -> required audit event.

During coding:
- Implement validation first (input, state transitions, permission checks).
- Keep controllers thin; place business logic in services.
- Ensure side effects (audit + notification logs) are explicit and deterministic.

Before handing off:
- Include tests for success, forbidden (`403`), not found (`404`), and invalid transition (`409`/`422`) paths.
- Confirm no logic branch relies on role names.

## Non-Goals (Current Phase)
- Full GitHub webhook processing.
- Zoho API-level integration.
- Slack delivery integration.

Design for these integrations, but do not block current backend delivery on them.

## Definition of Done for Backend Tasks
- Route is permission-enforced with the correct `CAN_*` key.
- Data writes and reads match schema constraints.
- Required audit and notification logs are persisted.
- Negative-path tests exist for unauthorized and invalid-state behavior.
- Public API behavior matches `README.md` route contract.
