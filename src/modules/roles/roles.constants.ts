export const ROLES_RESPONSE_MESSAGE = {
  ROLE_CREATED: "Role created successfully",
  ROLES_FETCHED: "Roles fetched successfully",
  ROLE_UPDATED: "Role updated successfully",
  ROLE_DELETED: "Role deleted successfully",
  ROLE_PERMISSION_ASSIGNED: "Permission assigned to role successfully",
  ROLE_PERMISSION_REMOVED: "Permission removed from role successfully"
} as const;

export const ROLES_ERROR_MESSAGE = {
  ROLE_NOT_FOUND: "Role not found",
  ROLE_NAME_ALREADY_EXISTS: "Role name already exists",
  PERMISSION_NOT_FOUND: "Permission not found",
  ROLE_PERMISSION_ALREADY_EXISTS: "Permission is already assigned to this role",
  ROLE_PERMISSION_NOT_FOUND: "Permission assignment not found for this role",
  AT_LEAST_ONE_FIELD_REQUIRED: "At least one field must be provided for role update"
} as const;
