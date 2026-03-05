export enum RouteAccessLevel {
  PUBLIC = "PUBLIC",
  AUTHENTICATED = "AUTHENTICATED",
  ACTIVE = "ACTIVE"
}

export const RBAC_ERROR_MESSAGE = {
  AUTH_REQUIRED: "Authentication required",
  FORBIDDEN: "Forbidden",
  INACTIVE_USER_ACCESS_BLOCKED: "Inactive users are not allowed to access this resource",
  STATUS_NOT_ALLOWED: "User status is not allowed for this action"
} as const;
