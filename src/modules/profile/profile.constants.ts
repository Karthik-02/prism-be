export const PROFILE_RESPONSE_MESSAGE = {
  PROFILE_FETCHED: "Profile fetched successfully",
  PROFILE_UPDATED: "Profile updated successfully"
} as const;

export const PROFILE_ERROR_MESSAGE = {
  USER_NOT_FOUND: "User not found",
  EMAIL_ALREADY_IN_USE: "Email is already in use",
  EMAIL_DOMAIN_NOT_ALLOWED: "Email domain is not allowed",
  AT_LEAST_ONE_FIELD_REQUIRED: "At least one profile field must be provided"
} as const;
