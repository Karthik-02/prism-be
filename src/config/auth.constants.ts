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

export const SESSION_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
