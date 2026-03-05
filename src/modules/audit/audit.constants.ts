export const AUDIT_ENTITY = {
  OTP_TOKEN: "OTP_TOKEN",
  USER: "USER",
  AUTH_SESSION: "AUTH_SESSION"
} as const;

export const AUDIT_ACTION = {
  AUTH_OTP_REQUESTED: "AUTH_OTP_REQUESTED",
  AUTH_OTP_EXPIRED: "AUTH_OTP_EXPIRED",
  AUTH_OTP_CONSUMED: "AUTH_OTP_CONSUMED",
  AUTH_USER_CREATED: "AUTH_USER_CREATED",
  AUTH_LOGIN_SUCCESS: "AUTH_LOGIN_SUCCESS"
} as const;

export const AUDIT_ERROR_MESSAGE = {
  SYSTEM_ACTOR_MISSING:
    "System audit actor not found. Run database seed before starting API writes."
} as const;

export type AuditEntity = (typeof AUDIT_ENTITY)[keyof typeof AUDIT_ENTITY];
export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];
