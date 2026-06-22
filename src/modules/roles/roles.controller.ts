import type { RequestHandler } from "express";

import { HTTP_STATUS } from "../../config/http.constants";
import { AppError } from "../../lib/app-error";
import { asyncHandler } from "../../lib/async-handler";
import { parseBody, parseParams } from "../../lib/validate";
import { RBAC_ERROR_MESSAGE } from "../rbac/rbac.constants";
import { ROLES_RESPONSE_MESSAGE } from "./roles.constants";
import {
  assignRolePermissionSchema,
  createRoleSchema,
  roleIdParamsSchema,
  rolePermissionParamsSchema,
  updateRoleSchema
} from "./roles.schema";
import { RolesService } from "./roles.service";

const rolesService = new RolesService();

const requireActorId = (actorUserId: string | undefined): string => {
  if (!actorUserId) {
    throw new AppError(RBAC_ERROR_MESSAGE.AUTH_REQUIRED, HTTP_STATUS.UNAUTHORIZED);
  }

  return actorUserId;
};

export const createRole: RequestHandler = asyncHandler(async (req, res) => {
  const actorUserId = requireActorId(req.auth?.userId);
  const payload = parseBody(createRoleSchema, req.body);
  const role = await rolesService.createRole(payload, actorUserId);

  res.status(HTTP_STATUS.OK).json({
    message: ROLES_RESPONSE_MESSAGE.ROLE_CREATED,
    role
  });
});

export const listRoles: RequestHandler = asyncHandler(async (_req, res) => {
  const roles = await rolesService.listRoles();

  res.status(HTTP_STATUS.OK).json({
    message: ROLES_RESPONSE_MESSAGE.ROLES_FETCHED,
    roles
  });
});

export const updateRole: RequestHandler = asyncHandler(async (req, res) => {
  const actorUserId = requireActorId(req.auth?.userId);
  const { id } = parseParams(roleIdParamsSchema, req.params);
  const payload = parseBody(updateRoleSchema, req.body);
  const role = await rolesService.updateRole(id, payload, actorUserId);

  res.status(HTTP_STATUS.OK).json({
    message: ROLES_RESPONSE_MESSAGE.ROLE_UPDATED,
    role
  });
});

export const deleteRole: RequestHandler = asyncHandler(async (req, res) => {
  const actorUserId = requireActorId(req.auth?.userId);
  const { id } = parseParams(roleIdParamsSchema, req.params);
  await rolesService.deleteRole(id, actorUserId);

  res.status(HTTP_STATUS.OK).json({
    message: ROLES_RESPONSE_MESSAGE.ROLE_DELETED
  });
});

export const assignPermissionToRole: RequestHandler = asyncHandler(async (req, res) => {
  const actorUserId = requireActorId(req.auth?.userId);
  const { id } = parseParams(roleIdParamsSchema, req.params);
  const payload = parseBody(assignRolePermissionSchema, req.body);
  const role = await rolesService.assignPermissionToRole(id, payload, actorUserId);

  res.status(HTTP_STATUS.OK).json({
    message: ROLES_RESPONSE_MESSAGE.ROLE_PERMISSION_ASSIGNED,
    role
  });
});

export const removePermissionFromRole: RequestHandler = asyncHandler(async (req, res) => {
  const actorUserId = requireActorId(req.auth?.userId);
  const { id, permissionId } = parseParams(rolePermissionParamsSchema, req.params);
  const role = await rolesService.removePermissionFromRole(id, permissionId, actorUserId);

  res.status(HTTP_STATUS.OK).json({
    message: ROLES_RESPONSE_MESSAGE.ROLE_PERMISSION_REMOVED,
    role
  });
});
