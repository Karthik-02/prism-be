# PRism Backend API Documentation

## Maintenance Rule

Whenever a new API is created or updated, this file must be updated in the same change.

## Base URL

- `http://localhost:3000/api/v1`

## Common Response Shapes

- Success:
```json
{
  "message": "string"
}
```
- Validation error (`400`):
```json
{
  "message": "Validation failed",
  "issues": {
    "fieldName": ["error message"]
  }
}
```
- App error (`400/401/403/404/409/422`):
```json
{
  "message": "string",
  "details": {}
}
```
- Server error (`500`):
```json
{
  "message": "Internal server error"
}
```

## 1) Health

### `GET /health`

- Auth: Public
- Request body: none
- Success `200`:
```json
{
  "status": "ok"
}
```

## 2) Auth

### `POST /auth/request-otp`

- Auth: Public
- Request body:
```json
{
  "email": "developer@company.com"
}
```
- Success `200`:
```json
{
  "message": "OTP sent successfully",
  "devOtp": "123456"
}
```
- Notes:
  - `devOtp` is returned only when `NODE_ENV` is not `production`.
  - Email domain must exist in `email_domains` with status `ACTIVE`.

### `POST /auth/verify-otp`

- Auth: Public
- Request body:
```json
{
  "email": "developer@company.com",
  "otp": "123456",
  "firstName": "Dev",
  "lastName": "User",
  "githubUserId": "dev-user"
}
```
- Success `200`:
```json
{
  "message": "OTP verified successfully",
  "user": {
    "id": "uuid",
    "email": "developer@company.com",
    "status": "PENDING_VERIFICATION",
    "roles": [
      {
        "id": "uuid",
        "name": "DEVELOPER"
      }
    ],
    "permissions": [],
    "sessionScope": "PROFILE_ONLY"
  },
  "session": {
    "id": "uuid",
    "expiresAt": "2026-04-04T11:15:56.000Z",
    "rotatedSessionCount": 0
  }
}
```
- Side effects:
  - Sets auth cookie (`JWT_COOKIE_NAME`) with HTTP-only session token.
  - Creates server-side session row in `auth_sessions`.
  - Revokes previously active sessions for the same user before issuing the new session.
  - Creates user if not already present.

### `POST /auth/logout`

- Auth: Authenticated (requires valid JWT cookie)
- Request body:
```json
{
  "scope": "CURRENT_SESSION"
}
```
- `scope` values:
  - `CURRENT_SESSION` (default): revoke only current cookie session.
  - `ALL_SESSIONS`: revoke all active sessions for current user.
- Success `200`:
```json
{
  "message": "Logged out successfully",
  "userId": "uuid",
  "scope": "CURRENT_SESSION",
  "revokedSessionCount": 1
}
```
- Side effects:
  - Revokes server-side session(s) from `auth_sessions`.
  - Clears auth cookie (`JWT_COOKIE_NAME`).

## 3) Profile

### `GET /profile`

- Auth: Authenticated (`ACTIVE`, `PENDING_VERIFICATION`, `DISAPPROVED`)
- Request body: none
- Success `200`:
```json
{
  "message": "Profile fetched successfully",
  "profile": {
    "id": "uuid",
    "firstName": "Dev",
    "lastName": "User",
    "email": "developer@company.com",
    "githubUserId": "dev-user",
    "status": "ACTIVE",
    "roles": [
      {
        "id": "uuid",
        "name": "LEAD"
      }
    ],
    "createdAt": "2026-03-05T06:30:00.000Z",
    "updatedAt": "2026-03-05T06:30:00.000Z"
  }
}
```

### `PUT /profile`

- Auth: Authenticated (`ACTIVE`, `PENDING_VERIFICATION`, `DISAPPROVED`)
- Request body (partial update):
```json
{
  "firstName": "Dev",
  "lastName": "User",
  "email": "developer@company.com",
  "githubUserId": "dev-user"
}
```
- Success `200`:
```json
{
  "message": "Profile updated successfully",
  "profile": {
    "id": "uuid",
    "firstName": "Dev",
    "lastName": "User",
    "email": "developer@company.com",
    "githubUserId": "dev-user",
    "status": "PENDING_VERIFICATION",
    "roles": [],
    "createdAt": "2026-03-05T06:30:00.000Z",
    "updatedAt": "2026-03-05T07:10:00.000Z"
  },
  "requiresVerification": true,
  "notifiedVerifierCount": 2
}
```
- Side effects:
  - If `email` or `githubUserId` changes, status is set to `PENDING_VERIFICATION`.
  - Notification outcomes are logged in `notification_logs` for `CAN_VERIFY_USERS` recipients.
  - Audit logs are created for profile write actions.

## 4) User Management

### `POST /users`

- Auth: `ACTIVE`
- Required permission: `CAN_CREATE_USER`
- Request body:
```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@company.com",
  "githubUserId": "jane-doe",
  "status": "PENDING_VERIFICATION"
}
```
- Success `200`:
```json
{
  "message": "User created successfully",
  "user": {
    "id": "uuid",
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@company.com",
    "githubUserId": "jane-doe",
    "status": "PENDING_VERIFICATION",
    "roles": [],
    "createdAt": "2026-03-05T07:20:00.000Z",
    "updatedAt": "2026-03-05T07:20:00.000Z"
  }
}
```

### `GET /users`

- Auth: `ACTIVE`
- Required permission: one of `CAN_CREATE_USER`, `CAN_VERIFY_USERS`, `CAN_ASSIGN_ROLE`
- Query params:
  - `status` (optional): `ACTIVE | INACTIVE | PENDING_VERIFICATION | DISAPPROVED`
  - lowercase values like `pending_verification` are also accepted
- Success `200`:
```json
{
  "message": "Users fetched successfully",
  "users": [
    {
      "id": "uuid",
      "firstName": "Jane",
      "lastName": "Doe",
      "email": "jane@company.com",
      "githubUserId": "jane-doe",
      "status": "PENDING_VERIFICATION",
      "roles": [
        {
          "id": "uuid",
          "name": "DEVELOPER"
        }
      ],
      "createdAt": "2026-03-05T07:20:00.000Z",
      "updatedAt": "2026-03-05T07:20:00.000Z"
    }
  ]
}
```

### `GET /users/directory`

- Auth: `ACTIVE`
- Required permission: none beyond active session
- Query params:
  - `status` (optional): `ACTIVE | INACTIVE | PENDING_VERIFICATION | DISAPPROVED`
  - `permissionKey` (optional): any permission key such as `CAN_REVIEW_PR`
  - `search` (optional): matches first name, last name, email, or GitHub user ID
- Success `200`:
```json
{
  "message": "Users fetched successfully",
  "users": [
    {
      "id": "uuid",
      "firstName": "Jane",
      "lastName": "Doe",
      "email": "jane@company.com",
      "githubUserId": "jane-doe",
      "status": "ACTIVE",
      "roles": [
        {
          "id": "uuid",
          "name": "LEAD"
        }
      ]
    }
  ]
}
```

### `POST /users/:id/approve`

- Auth: `ACTIVE`
- Required permission: `CAN_VERIFY_USERS`
- Request body: none
- Success `200`:
```json
{
  "message": "User approved successfully",
  "user": {
    "id": "uuid",
    "status": "ACTIVE"
  }
}
```

### `POST /users/:id/disapprove`

- Auth: `ACTIVE`
- Required permission: `CAN_VERIFY_USERS`
- Request body:
```json
{
  "reason": "Profile details are incomplete"
}
```
- Success `200`:
```json
{
  "message": "User disapproved successfully",
  "user": {
    "id": "uuid",
    "status": "DISAPPROVED"
  }
}
```

### `POST /users/:id/roles`

- Auth: `ACTIVE`
- Required permission: `CAN_ASSIGN_ROLE`
- Request body:
```json
{
  "roleId": "uuid"
}
```
- Success `200`:
```json
{
  "message": "Role assigned to user successfully",
  "user": {
    "id": "uuid",
    "roles": [
      {
        "id": "uuid",
        "name": "LEAD"
      }
    ]
  }
}
```

### `DELETE /users/:id/roles/:roleId`

- Auth: `ACTIVE`
- Required permission: `CAN_ASSIGN_ROLE`
- Request body: none
- Success `200`:
```json
{
  "message": "Role removed from user successfully",
  "user": {
    "id": "uuid",
    "roles": []
  }
}
```

## 5) Role Management

### `POST /roles`

- Auth: `ACTIVE`
- Required permission: `CAN_MANAGE_ROLES`
- Request body:
```json
{
  "name": "LEAD",
  "description": "Lead role",
  "permissions": [
    {
      "permissionKey": "CAN_REVIEW_PR"
    },
    {
      "permissionId": "uuid"
    }
  ]
}
```
- `permissions` accepts either a single object or a list of objects.
- Each object must contain exactly one field: `permissionId` or `permissionKey`.
- Success `200`:
```json
{
  "message": "Role created successfully",
  "role": {
    "id": "uuid",
    "name": "LEAD",
    "description": "Lead role",
    "createdBy": "uuid",
    "createdAt": "2026-03-05T08:10:00.000Z",
    "permissions": [
      {
        "id": "uuid",
        "key": "CAN_REVIEW_PR",
        "description": "CAN_REVIEW_PR"
      }
    ]
  }
}
```

### `GET /roles`

- Auth: `ACTIVE`
- Required permission: one of `CAN_MANAGE_ROLES`, `CAN_MANAGE_PERMISSIONS`, `CAN_ASSIGN_ROLE`
- Request body: none
- Success `200`:
```json
{
  "message": "Roles fetched successfully",
  "roles": [
    {
      "id": "uuid",
      "name": "LEAD",
      "description": "Lead role",
      "createdBy": "uuid",
      "createdAt": "2026-03-05T08:10:00.000Z",
      "permissions": [
        {
          "id": "uuid",
          "key": "CAN_REVIEW_PR",
          "description": "CAN_REVIEW_PR"
        }
      ]
    }
  ]
}
```

### `PUT /roles/:id`

- Auth: `ACTIVE`
- Required permission: `CAN_MANAGE_ROLES`
- Request body (partial):
```json
{
  "name": "LEAD_ENGINEERING",
  "description": "Updated description",
  "permissions": {
    "permissionKey": "CAN_ASSIGN_PR"
  }
}
```
- `permissions` accepts either a single object or a list of objects.
- When `permissions` is provided in update, role permissions are synced to exactly the provided set.
- Success `200`:
```json
{
  "message": "Role updated successfully",
  "role": {
    "id": "uuid",
    "name": "LEAD_ENGINEERING",
    "description": "Updated description",
    "permissions": [
      {
        "id": "uuid",
        "key": "CAN_ASSIGN_PR",
        "description": "CAN_ASSIGN_PR"
      }
    ]
  }
}
```

### `DELETE /roles/:id`

- Auth: `ACTIVE`
- Required permission: `CAN_MANAGE_ROLES`
- Request body: none
- Success `200`:
```json
{
  "message": "Role deleted successfully"
}
```

### `POST /roles/:id/permissions`

- Auth: `ACTIVE`
- Required permission: `CAN_MANAGE_PERMISSIONS`
- Request body (provide exactly one):
```json
{
  "permissionId": "uuid"
}
```
or
```json
{
  "permissionKey": "CAN_REVIEW_PR"
}
```
- Success `200`:
```json
{
  "message": "Permission assigned to role successfully",
  "role": {
    "id": "uuid",
    "permissions": [
      {
        "id": "uuid",
        "key": "CAN_REVIEW_PR",
        "description": "CAN_REVIEW_PR"
      }
    ]
  }
}
```

### `DELETE /roles/:id/permissions/:permissionId`

- Auth: `ACTIVE`
- Required permission: `CAN_MANAGE_PERMISSIONS`
- Request body: none
- Success `200`:
```json
{
  "message": "Permission removed from role successfully",
  "role": {
    "id": "uuid",
    "permissions": []
  }
}
```

## 6) Email Domain Management

### `GET /email-domains`

- Auth: `ACTIVE`
- Required permission: `CAN_MANAGE_EMAIL_DOMAIN`
- Request body: none
- Success `200`:
```json
{
  "message": "Email domains fetched successfully",
  "emailDomains": [
    {
      "id": "uuid",
      "domain": "company.com",
      "status": "ACTIVE",
      "createdBy": "uuid",
      "createdAt": "2026-03-06T09:00:00.000Z"
    }
  ]
}
```

### `POST /email-domains`

- Auth: `ACTIVE`
- Required permission: `CAN_MANAGE_EMAIL_DOMAIN`
- Request body:
```json
{
  "domain": "company.com",
  "status": "ACTIVE"
}
```
- `status` is optional and defaults to `ACTIVE`.
- Success `200`:
```json
{
  "message": "Email domain created successfully",
  "emailDomain": {
    "id": "uuid",
    "domain": "company.com",
    "status": "ACTIVE",
    "createdBy": "uuid",
    "createdAt": "2026-03-06T09:00:00.000Z"
  }
}
```

### `DELETE /email-domains/:id`

- Auth: `ACTIVE`
- Required permission: `CAN_MANAGE_EMAIL_DOMAIN`
- Request body: none
- Success `200`:
```json
{
  "message": "Email domain deleted successfully"
}
```

### `PATCH /email-domains/:id/status`

- Auth: `ACTIVE`
- Required permission: `CAN_MANAGE_EMAIL_DOMAIN`
- Request body:
```json
{
  "status": "INACTIVE"
}
```
- Success `200`:
```json
{
  "message": "Email domain status updated successfully",
  "emailDomain": {
    "id": "uuid",
    "domain": "company.com",
    "status": "INACTIVE",
    "createdBy": "uuid",
    "createdAt": "2026-03-06T09:00:00.000Z"
  }
}
```

## 7) PR Management

### `POST /prs`

- Auth: `ACTIVE`
- Required permission: `CAN_CREATE_PR`
- Request body:
```json
{
  "repo": "org/service-api",
  "branch": "feature/user-roles",
  "prLink": "https://github.com/org/service-api/pull/123",
  "type": "FEATURE",
  "reviewerId": "uuid",
  "zohoLink": "https://projects.zoho.com/...",
  "comments": "Initial submission"
}
```
- Success `200`:
```json
{
  "message": "PR created successfully",
  "pr": {
    "id": "uuid",
    "ownerId": "uuid",
    "repo": "org/service-api",
    "branch": "feature/user-roles",
    "prLink": "https://github.com/org/service-api/pull/123",
    "reviewerId": "uuid",
    "status": "SUBMITTED",
    "type": "FEATURE",
    "zohoLink": "https://projects.zoho.com/...",
    "deployedFlag": false,
    "comments": "Initial submission",
    "owner": {
      "id": "uuid",
      "firstName": "Dev",
      "lastName": "User",
      "email": "dev@company.com"
    },
    "reviewer": {
      "id": "uuid",
      "firstName": "Lead",
      "lastName": "User",
      "email": "lead@company.com"
    },
    "createdAt": "2026-03-06T09:30:00.000Z",
    "updatedAt": "2026-03-06T09:30:00.000Z"
  }
}
```

### `GET /prs`

- Auth: `ACTIVE`
- Scope behavior:
  - If caller has `CAN_VIEW_ALL_PRS`, results can include all PRs.
  - Otherwise results are restricted to caller-owned PRs.
- Query params (optional):
  - `status`: `SUBMITTED | UNDER_REVIEW | APPROVED | REJECTED | REREVIEW | DEPLOYED`
  - `type`: `FEATURE | ENHANCEMENT | BUG`
  - `ownerId`: UUID (applies only when caller has `CAN_VIEW_ALL_PRS`)
  - `reviewerId`: UUID
- Success `200`:
```json
{
  "message": "PRs fetched successfully",
  "prs": [
    {
      "id": "uuid",
      "ownerId": "uuid",
      "repo": "org/service-api",
      "branch": "feature/user-roles",
      "prLink": "https://github.com/org/service-api/pull/123",
      "reviewerId": "uuid",
      "status": "UNDER_REVIEW",
      "type": "FEATURE",
      "zohoLink": null,
      "deployedFlag": false,
      "comments": "Waiting for lead review",
      "owner": {
        "id": "uuid",
        "firstName": "Dev",
        "lastName": "User",
        "email": "dev@company.com"
      },
      "reviewer": {
        "id": "uuid",
        "firstName": "Lead",
        "lastName": "User",
        "email": "lead@company.com"
      },
      "createdAt": "2026-03-06T09:30:00.000Z",
      "updatedAt": "2026-03-06T10:15:00.000Z"
    }
  ]
}
```

### `PATCH /prs/:id/status`

- Auth: `ACTIVE`
- Required permission: `CAN_REVIEW_PR`
- Request body:
```json
{
  "status": "APPROVED",
  "comments": "Ready for deploy"
}
```
- Transition guardrails enforced:
  - `SUBMITTED -> UNDER_REVIEW`
  - `UNDER_REVIEW -> APPROVED | REJECTED | REREVIEW`
  - `REREVIEW -> UNDER_REVIEW | APPROVED | REJECTED`
  - `APPROVED -> DEPLOYED`
- Success `200`:
```json
{
  "message": "PR status updated successfully",
  "pr": {
    "id": "uuid",
    "status": "APPROVED",
    "comments": "Ready for deploy"
  }
}
```

### `PATCH /prs/:id/assign`

- Auth: `ACTIVE`
- Required permission: `CAN_ASSIGN_PR`
- Request body:
```json
{
  "reviewerId": "uuid"
}
```
- Reviewer constraints:
  - Reviewer must exist.
  - Reviewer must be `ACTIVE`.
  - Reviewer must have `CAN_REVIEW_PR` permission.
- Success `200`:
```json
{
  "message": "PR reviewer assigned successfully",
  "pr": {
    "id": "uuid",
    "reviewerId": "uuid"
  }
}

## 8) Release Management

### `POST /releases`

- Auth: `ACTIVE`
- Required permission: `CAN_MANAGE_RELEASE`
- Request body:
```json
{
  "environment": "STAGING",
  "name": "Staging 2026-03-17",
  "cutoffAt": "2026-03-16T16:00:00Z",
  "releaseDate": "2026-03-17T18:00:00Z",
  "status": "SCHEDULED"
}
```
- Success `200`:
```json
{
  "message": "Release created successfully",
  "release": {
    "id": "uuid",
    "environment": "STAGING",
    "status": "SCHEDULED",
    "name": "Staging 2026-03-17",
    "releaseDate": "2026-03-17T18:00:00Z",
    "cutoffAt": "2026-03-16T16:00:00Z",
    "createdBy": "uuid",
    "createdAt": "2026-03-15T10:00:00.000Z",
    "prCount": 5,
    "autoLinkedCount": 3
  }
}
```
- Notes:
  - `cutoffAt` controls when the release can still accept PR mapping.
  - STAGING releases automatically link `AUTO` PRs that were approved but not yet mapped to any staging or production release.
  - PRODUCTION releases auto-collect deployed `AUTO` PRs from the latest staging window since the previous production release.
  - Every release creation notifies leads (`CAN_MANAGE_RELEASE`) and all developers (`CAN_CREATE_PR`) via email and notification logs.

### `GET /releases`

- Auth: `ACTIVE`
- Required permission: one of `CAN_CREATE_PR`, `CAN_VIEW_ALL_PRS`, `CAN_MANAGE_RELEASE`, `CAN_SET_PROD_RELEASE_DATE`, `CAN_GENERATE_OWN_RELEASE_NOTES`, `CAN_GENERATE_FULL_RELEASE_NOTES`
- Query parameters:
  - `environment` (`STAGING | PRODUCTION | UAT`) optional
  - `status` (`CREATED | SCHEDULED | COMPLETED | CANCELLED`) optional
- Success `200`:
```json
{
  "message": "Releases fetched successfully",
  "releases": [
    {
      "id": "uuid",
      "environment": "STAGING",
      "status": "COMPLETED",
      "name": "Staging 2026-03-17",
      "releaseDate": "2026-03-17T18:00:00Z",
      "cutoffAt": "2026-03-16T16:00:00Z",
      "createdBy": "uuid",
      "createdAt": "2026-03-15T10:00:00.000Z",
      "prCount": 12,
      "autoLinkedCount": 4
    }
  ]
}
```

### `GET /releases/:id`

- Auth: `ACTIVE`
- Required permission: one of `CAN_MANAGE_RELEASE`, `CAN_SET_PROD_RELEASE_DATE`, `CAN_GENERATE_OWN_RELEASE_NOTES`, `CAN_GENERATE_FULL_RELEASE_NOTES`
- Request params:
  - `id`: release UUID
- Success `200`:
```json
{
  "message": "Release fetched successfully",
  "release": {
    "id": "uuid",
    "environment": "STAGING",
    "status": "SCHEDULED",
    "name": "Staging 2026-03-24",
    "releaseDate": "2026-03-24T18:00:00Z",
    "cutoffAt": "2026-03-23T15:00:00Z",
    "createdBy": "uuid",
    "createdAt": "2026-03-22T10:00:00.000Z",
    "prCount": 8,
    "autoLinkedCount": 3,
    "linkedPrs": [
      {
        "prId": "uuid",
        "source": "MANUAL",
        "addedBy": "uuid",
        "linkedAt": "2026-03-23T11:00:00.000Z",
        "pr": {
          "id": "uuid",
          "repo": "prism-fe",
          "branch": "feature/release-panel",
          "prLink": "https://github.com/org/repo/pull/10",
          "status": "APPROVED",
          "type": "FEATURE",
          "deployedFlag": false,
          "releaseMode": "MANUAL",
          "comments": "Ready for stage",
          "owner": {
            "id": "uuid",
            "firstName": "Jane",
            "lastName": "Doe",
            "email": "jane@company.com"
          },
          "reviewer": {
            "id": "uuid",
            "firstName": "Lead",
            "lastName": "User",
            "email": "lead@company.com"
          },
          "createdAt": "2026-03-22T09:00:00.000Z",
          "updatedAt": "2026-03-22T11:30:00.000Z"
        }
      }
    ],
    "eligiblePrs": []
  }
}
```

### `POST /releases/:id/add-pr`

- Auth: `ACTIVE`
- Required permission: `CAN_MANAGE_RELEASE`
- Request body:
```json
{
  "prId": "uuid",
  "source": "MANUAL"
}
```
- Success `200`:
```json
{
  "message": "PR linked to release successfully"
}
```
- Notes:
  - STAGING releases only accept approved or deployed PRs.
  - PRODUCTION releases only accept PRs already deployed in STAGING.
  - Attempts to add a PR after the release cutoff or that already exists in the release return `422`/`409`.
  - Manual adds still create audit logs and notification outcomes.

### `DELETE /releases/:id/remove-pr`

- Auth: `ACTIVE`
- Required permission: `CAN_MANAGE_RELEASE`
- Request body:
```json
{
  "prId": "uuid"
}
```
- Success `200`:
```json
{
  "message": "PR removed from release successfully"
}
```

### `PATCH /releases/:id`

- Auth: `ACTIVE`
- Required permission: `CAN_MANAGE_RELEASE`
- Request body (partial update):
```json
{
  "name": "Stage 2026-03-24",
  "status": "SCHEDULED",
  "cutoffAt": "2026-03-23T15:00:00Z"
}
```
- Success `200`:
```json
{
  "message": "Release updated successfully",
  "release": { ... }
}
```

### `PATCH /releases/:id/date`

- Auth: `ACTIVE`
- Required permission: `CAN_SET_PROD_RELEASE_DATE`
- Request body:
```json
{
  "releaseDate": "2026-03-24T18:00:00Z"
}
```
- Success `200`:
```json
{
  "message": "Release date updated successfully",
  "release": { ... }
}
```

## 9) Release Notes

### `GET /release-notes/my`

- Auth: `ACTIVE`
- Required permission: `CAN_GENERATE_OWN_RELEASE_NOTES`
- Query string:
  - `releaseId`: UUID
- Success `200`:
```json
{
  "message": "Release notes fetched successfully",
  "releaseNote": {
    "id": "uuid",
    "releaseId": "uuid",
    "scope": "OWN",
    "ownerId": "uuid",
    "content": "# Release notes ...",
    "other": [
      {
        "title": "Other",
        "content": "Additional markdown entries"
      }
    ],
    "version": 2,
    "updatedAt": "2026-03-18T12:00:00.000Z"
  }
}
```
### `PUT /release-notes/my`

- Auth: `ACTIVE`
- Required permission: `CAN_GENERATE_OWN_RELEASE_NOTES`
- Query string: `releaseId`
- Request body:
```json
{
  "content": "# Updated release notes",
  "other": [
    {
      "title": "Other",
      "content": "Additional Markdown"
    }
  ],
  "expectedVersion": 2
}
```
- Success `200`:
```json
{
  "message": "Release notes updated successfully",
  "releaseNote": { ... }
}
```
- Notes:
  - `expectedVersion` enables optimistic concurrency (merge resolution) when multiple users edit the same note.
  - `other` entries are merged into the release note body under an `## Other` heading and are also surfaced in the auto-generated markdown.

### `GET /release-notes/:releaseId`

- Auth: `ACTIVE`
- Required permission: `CAN_GENERATE_FULL_RELEASE_NOTES`
- Success `200`: similar to `GET /release-notes/my` but `scope` is `FULL`.

### `PUT /release-notes/:releaseId`

- Auth: `ACTIVE`
- Required permission: `CAN_GENERATE_FULL_RELEASE_NOTES`
- Request body: same as the `PUT /release-notes/my` payload.

## 10) Audit Logs

### `GET /audit-logs`

- Auth: `ACTIVE`
- Required permission: `CAN_MANAGE_ROLES` or `CAN_MANAGE_RELEASE`
- Query params:
  - `limit` (optional, minimum `1`, maximum `50`)
- Success `200`:
```json
[
  {
    "id": "uuid",
    "entityType": "RELEASE",
    "action": "ADD_PR",
    "performedBy": "Release Manager",
    "metadata": {
      "prId": "uuid",
      "releaseId": "release-staging"
    },
    "createdAt": "2026-03-17T10:00:00.000Z"
  }
]
```

## 11) Notifications

### `GET /notifications`

- Auth: `ACTIVE`
- Required permission: `CAN_MANAGE_RELEASE` or `CAN_MANAGE_ROLES`
- Query params:
  - `limit` (optional, minimum `1`, maximum `50`)
- Success `200`:
```json
[
  {
    "id": "uuid",
    "eventType": "RELEASE_REMINDER",
    "recipient": "All Developers",
    "status": "SENT",
    "createdAt": "2026-03-17T09:00:00.000Z"
  }
]
```

## 12) Common Error Cases

- `401`: `Authentication required`
- `403`: `Forbidden` or domain/status restrictions
- `404`: target `user` / `role` / `permission` / `email domain` / `pr` not found
- `409`: duplicate email, duplicate role name, duplicate role/permission assignment
- `422`: invalid PR status transition or invalid reviewer eligibility
- All write APIs persist audit logs.
- PR assignment and PR status change notification outcomes are persisted in `notification_logs`.
