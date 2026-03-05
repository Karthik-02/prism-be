# PRism Backend (`prism-be`)

Backend API for PRism: an internal RBAC-first PR and release management platform that centralizes PR tracking, structured approvals, release composition, and auditable operational governance.

## 0) Current Implementation Status

Implemented in this phase:

- Base Express + TypeScript service structure.
- Prisma schema + initial SQL migration + seed script.
- Auth module:
  - `POST /api/v1/auth/request-otp`
  - `POST /api/v1/auth/verify-otp`
  - `POST /api/v1/auth/logout`
- RBAC foundation:
  - JWT cookie authentication middleware.
  - Permission resolution service (roles -> permissions union).
- Dockerized local stack (`prism-be` + PostgreSQL) via `docker-compose.yml`.

Not implemented yet (scaffold only): `profile`, `users`, `roles`, `email-domains`, `prs`, `releases`, `release-notes`, `audit`, `notifications`.

## Quick Start

### Local (Node.js)

1. Install dependencies:
   - `npm install`
2. Copy env:
   - `cp .env.example .env`
3. Apply DB migration:
   - `npm run prisma:migrate:dev`
4. Seed bootstrap data (permissions + `SUPER_ADMIN`):
   - `npm run db:seed`
5. Run API:
   - `npm run dev`

API base URL: `http://localhost:3000/api/v1`

### Docker

1. Copy env:
   - `cp .env.example .env`
2. Start stack:
   - `docker compose up --build`
3. Seed bootstrap data (once DB is up):
   - `docker compose exec prism-be npm run db:seed`

## Engineering Standards (Mandatory)

- Use JavaScript/TypeScript strict mode (`"strict": true` in `tsconfig.json`).
- Follow separation of concerns.
- Use service layer pattern.
- No business logic inside controllers.
- All routes must use RBAC middleware.
- All write operations must create audit logs.
- Prefer explicit over implicit.
- No magic strings; use enums/constants.
- Use Winston for structured server logs with meaningful context for key business actions and failures.
- Keep `APIDoc.md` updated whenever a new API route is added or changed.

## 1) Backend Scope

This service owns:

- Auth (OTP + JWT), user status gating, and profile lifecycle.
- Permission-based authorization (no role-name branching).
- PR lifecycle tracking and reviewer assignment.
- Staging/production/UAT release management and PR mapping.
- Release note generation (own vs full scope).
- User/role/permission administration.
- Email-domain access control and user verification workflows.
- Immutable audit logs and notification delivery logs.

## 2) Tech Stack

- Runtime: Node.js
- API: Express.js + TypeScript
- ORM: Prisma
- Database: PostgreSQL
- Auth: JWT (cookie-based) with OTP verification flow
- Email: pluggable provider (Nodemailer/Resend compatible)
- Validation and DX helpers: Zod + ESLint + Prettier

## 3) Architecture Overview

Primary modules:

- `auth`: request OTP, verify OTP, logout, JWT/session handling.
- `rbac`: permission resolution from roles and middleware enforcement.
- `profile`: read/update own profile with verification side effects.
- `users`: create/list users, verify/disapprove, role assignment.
- `roles`: role CRUD and permission binding.
- `email-domains`: domain allowlist lifecycle and status management.
- `prs`: PR creation, listing, status updates, and reassignment.
- `releases`: environment release creation, PR mapping, and release dates.
- `release-notes`: own and full release notes generation.
- `audit`: immutable event recording.
- `notifications`: recipient resolution + delivery outcome logging.

## 4) Lifecycle Definitions

### PR lifecycle states

- `SUBMITTED`
- `UNDER_REVIEW`
- `APPROVED`
- `REJECTED`
- `REREVIEW`
- `DEPLOYED`

Expected transition guardrails:

- `SUBMITTED -> UNDER_REVIEW`
- `UNDER_REVIEW -> APPROVED | REJECTED | REREVIEW`
- `REREVIEW -> UNDER_REVIEW | APPROVED | REJECTED`
- `APPROVED -> DEPLOYED`

### Release lifecycle concepts

- `Staging Created`
- `Production Created`
- `Production Scheduled`
- `Production Completed`

Release environments:

- `STAGING`
- `PRODUCTION`

## 5) Permission Model (Authoritative Contract)

Authorization contract:

- User has many roles (`user_roles`).
- Role has many permissions (`role_permissions`).
- Effective user permissions = union of all attached role permissions.
- Controller and service logic must never check role names directly.

Canonical permission keys:

- `CAN_CREATE_PR`
- `CAN_VIEW_ALL_PRS`
- `CAN_REVIEW_PR`
- `CAN_ASSIGN_PR`
- `CAN_GENERATE_OWN_RELEASE_NOTES`
- `CAN_GENERATE_FULL_RELEASE_NOTES`
- `CAN_MANAGE_ROLES`
- `CAN_MANAGE_PERMISSIONS`
- `CAN_MANAGE_EMAIL_DOMAIN`
- `CAN_VERIFY_USERS`
- `CAN_CREATE_USER`
- `CAN_ASSIGN_ROLE`
- `CAN_MANAGE_RELEASE`
- `CAN_SET_PROD_RELEASE_DATE`

## 6) Database Schema Contract

### `users`

- `id` UUID PK
- `first_name` varchar
- `last_name` varchar
- `email` varchar unique
- `github_user_id` varchar
- `status` enum: `ACTIVE | INACTIVE | PENDING_VERIFICATION | DISAPPROVED`
- `created_at` timestamp
- `updated_at` timestamp

### `roles`

- `id` UUID PK
- `name` varchar unique
- `description` text
- `created_by` UUID FK -> `users.id`
- `created_at` timestamp

### `permissions`

- `id` UUID PK
- `key` varchar unique
- `description` text
- `created_at` timestamp

### `role_permissions`

- `role_id` UUID FK -> `roles.id`
- `permission_id` UUID FK -> `permissions.id`
- `created_at` timestamp
- Composite PK: (`role_id`, `permission_id`)

### `user_roles`

- `user_id` UUID FK -> `users.id`
- `role_id` UUID FK -> `roles.id`
- `created_at` timestamp
- Composite PK: (`user_id`, `role_id`)

### `email_domains`

- `id` UUID PK
- `domain` varchar unique
- `status` enum: `ACTIVE | INACTIVE`
- `created_by` UUID
- `created_at` timestamp

### `otp_tokens`

- `id` UUID PK
- `email` varchar
- `otp` varchar
- `expires_at` timestamp
- `used` boolean
- `created_at` timestamp

### `prs`

- `id` UUID PK
- `owner_id` UUID FK -> `users.id`
- `repo` varchar
- `branch` varchar
- `pr_link` text
- `reviewer_id` UUID FK -> `users.id` nullable
- `status` enum: `SUBMITTED | UNDER_REVIEW | APPROVED | REJECTED | REREVIEW | DEPLOYED`
- `type` enum: `FEATURE | ENHANCEMENT | BUG`
- `zoho_link` text nullable
- `deployed_flag` boolean
- `comments` text
- `created_at` timestamp
- `updated_at` timestamp

### `releases`

- `id` UUID PK
- `environment` enum: `STAGING | PRODUCTION | UAT`
- `name` varchar
- `release_date` timestamp nullable
- `created_by` UUID
- `created_at` timestamp

### `release_pr_map`

- `release_id` UUID FK -> `releases.id`
- `pr_id` UUID FK -> `prs.id`
- `created_at` timestamp
- Composite PK: (`release_id`, `pr_id`)

### `audit_logs`

- `id` UUID PK
- `entity_type` varchar
- `entity_id` UUID
- `action` varchar
- `performed_by` UUID
- `metadata` jsonb
- `created_at` timestamp

Contract: immutable (append only) for role changes, permission changes, status transitions, verification actions, domain changes, and PR reassignment.

### `notification_logs`

- `id` UUID PK
- `event_type` varchar
- `recipient_id` UUID
- `status` enum: `SENT | FAILED`
- `created_at` timestamp

## 7) Authentication and Verification Flow

1. Validate email domain against `email_domains`.
2. Reject request when domain is missing or inactive.
3. Generate/store OTP in `otp_tokens` (`used=false`, bounded `expires_at`).
4. Verify OTP with expiry and `used` checks.
5. Mark OTP as used.
6. Issue JWT (cookie-based, one-month session target).
7. Enforce user status gate:
   - `ACTIVE`: full permission-based access.
   - `INACTIVE`: deny login.
   - `PENDING_VERIFICATION`: profile-only scope.
   - `DISAPPROVED`: profile-only scope.

Profile side effect contract:

- If profile email or GitHub ID changes, set status to `PENDING_VERIFICATION` and notify users with `CAN_VERIFY_USERS`.

## 8) API Route Contract (v1)

All protected routes must pass permission middleware.

### Auth

- `POST /auth/request-otp` (public entry, domain-gated)
- `POST /auth/verify-otp` (public entry)
- `POST /auth/logout` (authenticated)

### Profile

- `GET /profile`
- `PUT /profile`

### User Management

- `POST /users` -> requires `CAN_CREATE_USER`
- `GET /users` -> requires `CAN_CREATE_USER`
- `GET /users?status=pending_verification` -> requires `CAN_CREATE_USER`
- `POST /users/:id/approve` -> requires `CAN_VERIFY_USERS`
- `POST /users/:id/disapprove` -> requires `CAN_VERIFY_USERS`
- `POST /users/:id/roles` -> requires `CAN_ASSIGN_ROLE`
- `DELETE /users/:id/roles/:roleId` -> requires `CAN_ASSIGN_ROLE`

### Role Management

- `POST /roles` -> requires `CAN_MANAGE_ROLES`
- `GET /roles` -> requires `CAN_MANAGE_ROLES`
- `PUT /roles/:id` -> requires `CAN_MANAGE_ROLES`
- `DELETE /roles/:id` -> requires `CAN_MANAGE_ROLES`
- `POST /roles/:id/permissions` -> requires `CAN_MANAGE_PERMISSIONS`
- `DELETE /roles/:id/permissions/:permissionId` -> requires `CAN_MANAGE_PERMISSIONS`

### Email Domain Management

- `GET /email-domains` -> requires `CAN_MANAGE_EMAIL_DOMAIN`
- `POST /email-domains` -> requires `CAN_MANAGE_EMAIL_DOMAIN`
- `DELETE /email-domains/:id` -> requires `CAN_MANAGE_EMAIL_DOMAIN`
- `PATCH /email-domains/:id/status` -> requires `CAN_MANAGE_EMAIL_DOMAIN`

### PR Management

- `POST /prs` -> requires `CAN_CREATE_PR`
- `GET /prs` -> owner-scoped unless user has `CAN_VIEW_ALL_PRS`
- `PATCH /prs/:id/status` -> requires `CAN_REVIEW_PR`
- `PATCH /prs/:id/assign` -> requires `CAN_ASSIGN_PR`

### Release Management

- `POST /releases` -> requires `CAN_MANAGE_RELEASE`
- `GET /releases` -> requires `CAN_MANAGE_RELEASE`
- `POST /releases/:id/add-pr` -> requires `CAN_MANAGE_RELEASE`
- `DELETE /releases/:id/remove-pr` -> requires `CAN_MANAGE_RELEASE`
- `PATCH /releases/:id/date` -> requires `CAN_SET_PROD_RELEASE_DATE`

### Release Notes

- `GET /release-notes/my` -> requires `CAN_GENERATE_OWN_RELEASE_NOTES`
- `GET /release-notes/:releaseId` -> requires `CAN_GENERATE_FULL_RELEASE_NOTES`

## 9) Audit and Notification Requirements

Must emit audit events for:

- Role creation/update/deletion.
- Permission assignment/removal from roles.
- PR status transitions and reassignment.
- User verification approval/disapproval.
- Email domain updates and status changes.

Must persist notification outcomes:

- PR assignment notifications.
- PR status change notifications.
- Release reminder notifications.
- Verification-related notifications.

## 10) Seed/Bootstrap Requirements

On first deployment:

1. Seed all canonical permissions in `permissions`.
2. Create `SUPER_ADMIN` role.
3. Assign all permissions to `SUPER_ADMIN`.
4. Create first user.
5. Assign `SUPER_ADMIN` role to first user.

## 11) Implementation Milestones

1. Auth + OTP + domain restrictions + status gating.
2. RBAC middleware + permission resolution.
3. User, role, permission, and domain management endpoints.
4. PR lifecycle and assignment endpoints.
5. Release creation, PR mapping, and release date endpoints.
6. Release notes endpoints (own + full).
7. Audit/notification hardening and consistency checks.

## 12) Test Strategy and Acceptance Scenarios

### Unit tests

- Permission set resolution across multiple roles.
- PR status transition validator behavior.
- OTP validity checks (expired/used/invalid).

### Integration tests

- Protected route authn/authz gating.
- Owner-only `GET /prs` behavior without `CAN_VIEW_ALL_PRS`.
- Verification workflow after profile identity changes.
- Domain rejection and inactive-user login rejection.

### Data integrity tests

- Composite PK uniqueness on `role_permissions`, `user_roles`, `release_pr_map`.
- Immutable handling of `audit_logs` at service level.

### Required acceptance scenarios

- User without `CAN_REVIEW_PR` calling `PATCH /prs/:id/status` returns `403`.
- User without `CAN_VIEW_ALL_PRS` sees only own PRs from `GET /prs`.
- Email/GitHub profile change sets `PENDING_VERIFICATION` and triggers verifier notification.
- Expired OTP verification fails.
- Inactive/blocked email domain OTP request fails.
- Role-permission mutation writes an audit entry.
- Duplicate PR mapping into a release fails by constraint.
- Unauthorized role-management operation returns `403`.

## 13) Out of Scope (Current Backend Phase)

- Full GitHub webhook ingestion and verification flow.
- Live Zoho API integration.
- Slack notification integration.

Design should remain extensible for these integrations without blocking the current release.
