# Module Layout

- `auth`: implemented in this phase (`request-otp`, `verify-otp`, `logout`).
- `profile`: implemented (`GET /profile`, `PUT /profile`).
- `users`: implemented (`POST /users`, `GET /users`, verification, role assignment routes).
- `roles`: implemented (role CRUD + role permission binding routes).
- `email-domains`: implemented (`GET/POST/DELETE/PATCH /email-domains*`).
- `prs`: implemented (`POST /prs`, scoped `GET /prs`, status and assignment patch routes).
- `rbac`: permission resolution + middleware.
- `releases`: orchestrates STAGE/PROD release creation, PR mapping/auto-linking, cutoff control, and release-specific notifications.
- `release-notes`: powers own/full release note generation, `other` content blocks, and optimistic merge-safe editing for collaborators.
- `audit`: reserved for audit logging services.
- `notifications`: reserved for notification delivery/logging services.
