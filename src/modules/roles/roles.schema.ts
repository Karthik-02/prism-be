import { z } from "zod";

import { PERMISSION_KEY } from "../../config/permissions";
import { VALIDATION_LIMITS } from "../../config/validation.constants";
import { ROLES_ERROR_MESSAGE } from "./roles.constants";

const ROLE_DESCRIPTION_MAX_LENGTH = 1000;

const permissionReferenceSchema = z
  .object({
    permissionId: z.string().uuid().optional(),
    permissionKey: z.nativeEnum(PERMISSION_KEY).optional()
  })
  .refine(
    (input) =>
      (typeof input.permissionId === "string" && typeof input.permissionKey === "undefined") ||
      (typeof input.permissionId === "undefined" && typeof input.permissionKey === "string"),
    {
      message: "Provide exactly one of permissionId or permissionKey"
    }
  );

const rolePermissionsInputSchema = z
  .union([permissionReferenceSchema, z.array(permissionReferenceSchema).min(1)])
  .transform((input) => (Array.isArray(input) ? input : [input]));

export const createRoleSchema = z.object({
  name: z.string().trim().min(1).max(VALIDATION_LIMITS.NAME_MAX_LENGTH),
  description: z.string().trim().max(ROLE_DESCRIPTION_MAX_LENGTH).optional(),
  permissions: rolePermissionsInputSchema.optional()
});

export const updateRoleSchema = z
  .object({
    name: z.string().trim().min(1).max(VALIDATION_LIMITS.NAME_MAX_LENGTH).optional(),
    description: z.string().trim().max(ROLE_DESCRIPTION_MAX_LENGTH).nullable().optional(),
    permissions: rolePermissionsInputSchema.optional()
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: ROLES_ERROR_MESSAGE.AT_LEAST_ONE_FIELD_REQUIRED
  });

export const roleIdParamsSchema = z.object({
  id: z.string().uuid()
});

export const assignRolePermissionSchema = permissionReferenceSchema;

export const rolePermissionParamsSchema = z.object({
  id: z.string().uuid(),
  permissionId: z.string().uuid()
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type RoleIdParamsInput = z.infer<typeof roleIdParamsSchema>;
export type AssignRolePermissionInput = z.infer<typeof assignRolePermissionSchema>;
export type RolePermissionParamsInput = z.infer<typeof rolePermissionParamsSchema>;
export type RolePermissionReferenceInput = z.infer<typeof permissionReferenceSchema>;
