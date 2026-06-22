export const EMAIL_DOMAINS_RESPONSE_MESSAGE = {
  EMAIL_DOMAINS_FETCHED: "Email domains fetched successfully",
  EMAIL_DOMAIN_CREATED: "Email domain created successfully",
  EMAIL_DOMAIN_DELETED: "Email domain deleted successfully",
  EMAIL_DOMAIN_STATUS_UPDATED: "Email domain status updated successfully"
} as const;

export const EMAIL_DOMAINS_ERROR_MESSAGE = {
  EMAIL_DOMAIN_NOT_FOUND: "Email domain not found",
  EMAIL_DOMAIN_ALREADY_EXISTS: "Email domain already exists",
  INVALID_DOMAIN_FORMAT: "Invalid domain format"
} as const;
