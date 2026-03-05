# PRism Backend API Documentation

## Maintenance Rule

Whenever a new API is created, this file must be updated in the same change.

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
- App error (`400/401/403/404`):
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
    "permissions": [],
    "sessionScope": "PROFILE_ONLY"
  }
}
```
- Side effects:
  - Sets auth cookie (`JWT_COOKIE_NAME`) with HTTP-only session token.
  - Creates user if not already present.

### `POST /auth/logout`

- Auth: Authenticated (requires valid JWT cookie)
- Request body: none
- Success `200`:
```json
{
  "message": "Logged out successfully"
}
```
- Side effects:
  - Clears auth cookie (`JWT_COOKIE_NAME`).

## Current Error Cases by Endpoint

- `POST /auth/request-otp`
  - `403`: `Email domain is not allowed`
  - `400`: invalid email format
- `POST /auth/verify-otp`
  - `400`: `Invalid OTP` / `OTP has expired` / `OTP already used`
  - `403`: `Inactive users are not allowed to log in`
  - `400`: invalid payload
- `POST /auth/logout`
  - `401`: `Authentication required`
