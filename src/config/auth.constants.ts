export const AUTH_RESPONSE_MESSAGE = {
  OTP_SENT: "OTP sent successfully",
  OTP_VERIFIED: "OTP verified successfully",
  LOGOUT_SUCCESS: "Logged out successfully"
} as const;

export const AUTH_ERROR_MESSAGE = {
  INVALID_EMAIL: "Invalid email",
  DOMAIN_NOT_ALLOWED: "Email domain is not allowed",
  INVALID_OTP: "Invalid OTP",
  EXPIRED_OTP: "OTP has expired",
  USED_OTP: "OTP already used",
  INACTIVE_USER_LOGIN_BLOCKED: "Inactive users are not allowed to log in"
} as const;

export const SESSION_SCOPE = {
  FULL_ACCESS: "FULL_ACCESS",
  PROFILE_ONLY: "PROFILE_ONLY"
} as const;

export type SessionScope = (typeof SESSION_SCOPE)[keyof typeof SESSION_SCOPE];

export const LOGOUT_SCOPE = {
  CURRENT_SESSION: "CURRENT_SESSION",
  ALL_SESSIONS: "ALL_SESSIONS"
} as const;

export type LogoutScope = (typeof LOGOUT_SCOPE)[keyof typeof LOGOUT_SCOPE];

export const AUTH_SESSION_REVOKE_REASON = {
  USER_LOGOUT_CURRENT: "USER_LOGOUT_CURRENT",
  USER_LOGOUT_ALL: "USER_LOGOUT_ALL",
  NEW_LOGIN_ROTATION: "NEW_LOGIN_ROTATION",
  ADMIN_REVOKED: "ADMIN_REVOKED"
} as const;

export const SESSION_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
