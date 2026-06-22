export const USERS_RESPONSE_MESSAGE = {
  USER_CREATED: "User created successfully",
  USERS_FETCHED: "Users fetched successfully",
  USER_APPROVED: "User approved successfully",
  USER_DISAPPROVED: "User disapproved successfully",
  USER_ROLE_ASSIGNED: "Role assigned to user successfully",
  USER_ROLE_REMOVED: "Role removed from user successfully"
} as const;

export const USERS_ERROR_MESSAGE = {
  USER_NOT_FOUND: "User not found",
  ROLE_NOT_FOUND: "Role not found",
  EMAIL_ALREADY_IN_USE: "Email is already in use",
  EMAIL_DOMAIN_NOT_ALLOWED: "Email domain is not allowed",
  USER_ROLE_ALREADY_ASSIGNED: "Role is already assigned to the user",
  USER_ROLE_NOT_ASSIGNED: "Role assignment not found for the user"
} as const;
