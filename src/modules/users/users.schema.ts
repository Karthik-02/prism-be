import { UserStatus } from "@prisma/client";
import { z } from "zod";

import { PERMISSION_KEY } from "../../config/permissions";
import { VALIDATION_LIMITS } from "../../config/validation.constants";

const normalizedStatusSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
  z.nativeEnum(UserStatus)
);

export const createUserSchema = z.object({
  firstName: z.string().trim().min(1).max(VALIDATION_LIMITS.NAME_MAX_LENGTH),
  lastName: z.string().trim().min(1).max(VALIDATION_LIMITS.NAME_MAX_LENGTH),
  email: z.string().trim().email(),
  githubUserId: z.string().trim().min(1).max(VALIDATION_LIMITS.GITHUB_USER_ID_MAX_LENGTH),
  status: z.nativeEnum(UserStatus).default(UserStatus.PENDING_VERIFICATION)
});

export const listUsersQuerySchema = z.object({
  status: normalizedStatusSchema.optional()
});

export const userDirectoryQuerySchema = z.object({
  status: normalizedStatusSchema.optional(),
  permissionKey: z.nativeEnum(PERMISSION_KEY).optional(),
  search: z.string().trim().min(1).max(120).optional()
});

export const userIdParamsSchema = z.object({
  id: z.string().uuid()
});

export const disapproveUserSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional()
});

export const assignUserRoleSchema = z.object({
  roleId: z.string().uuid()
});

export const userRoleParamsSchema = z.object({
  id: z.string().uuid(),
  roleId: z.string().uuid()
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type ListUsersQueryInput = z.infer<typeof listUsersQuerySchema>;
export type UserDirectoryQueryInput = z.infer<typeof userDirectoryQuerySchema>;
export type UserIdParamsInput = z.infer<typeof userIdParamsSchema>;
export type DisapproveUserInput = z.infer<typeof disapproveUserSchema>;
export type AssignUserRoleInput = z.infer<typeof assignUserRoleSchema>;
export type UserRoleParamsInput = z.infer<typeof userRoleParamsSchema>;
