import type { RequestHandler } from "express";

import { HTTP_STATUS } from "../../config/http.constants";
import { AppError } from "../../lib/app-error";
import { asyncHandler } from "../../lib/async-handler";
import { parseBody, parseParams, parseQuery } from "../../lib/validate";
import { RBAC_ERROR_MESSAGE } from "../rbac/rbac.constants";
import { USERS_RESPONSE_MESSAGE } from "./users.constants";
import {
  assignUserRoleSchema,
  createUserSchema,
  disapproveUserSchema,
  listUsersQuerySchema,
  userDirectoryQuerySchema,
  userIdParamsSchema,
  userRoleParamsSchema
} from "./users.schema";
import { UsersService } from "./users.service";

const usersService = new UsersService();

const requireActorId = (actorUserId: string | undefined): string => {
  if (!actorUserId) {
    throw new AppError(RBAC_ERROR_MESSAGE.AUTH_REQUIRED, HTTP_STATUS.UNAUTHORIZED);
  }

  return actorUserId;
};

export const createUser: RequestHandler = asyncHandler(async (req, res) => {
  const actorUserId = requireActorId(req.auth?.userId);
  const payload = parseBody(createUserSchema, req.body);

  const user = await usersService.createUser(payload, actorUserId);

  res.status(HTTP_STATUS.OK).json({
    message: USERS_RESPONSE_MESSAGE.USER_CREATED,
    user
  });
});

export const listUsers: RequestHandler = asyncHandler(async (req, res) => {
  const query = parseQuery(listUsersQuerySchema, req.query);
  const users = await usersService.listUsers(query);

  res.status(HTTP_STATUS.OK).json({
    message: USERS_RESPONSE_MESSAGE.USERS_FETCHED,
    users
  });
});

export const listUserDirectory: RequestHandler = asyncHandler(async (req, res) => {
  const query = parseQuery(userDirectoryQuerySchema, req.query);
  const users = await usersService.listUserDirectory(query);

  res.status(HTTP_STATUS.OK).json({
    message: USERS_RESPONSE_MESSAGE.USERS_FETCHED,
    users
  });
});

export const approveUser: RequestHandler = asyncHandler(async (req, res) => {
  const actorUserId = requireActorId(req.auth?.userId);
  const { id } = parseParams(userIdParamsSchema, req.params);
  const user = await usersService.approveUser(id, actorUserId);

  res.status(HTTP_STATUS.OK).json({
    message: USERS_RESPONSE_MESSAGE.USER_APPROVED,
    user
  });
});

export const disapproveUser: RequestHandler = asyncHandler(async (req, res) => {
  const actorUserId = requireActorId(req.auth?.userId);
  const { id } = parseParams(userIdParamsSchema, req.params);
  const payload = parseBody(disapproveUserSchema, req.body ?? {});
  const user = await usersService.disapproveUser(id, payload, actorUserId);

  res.status(HTTP_STATUS.OK).json({
    message: USERS_RESPONSE_MESSAGE.USER_DISAPPROVED,
    user
  });
});

export const assignRoleToUser: RequestHandler = asyncHandler(async (req, res) => {
  const actorUserId = requireActorId(req.auth?.userId);
  const { id } = parseParams(userIdParamsSchema, req.params);
  const payload = parseBody(assignUserRoleSchema, req.body);
  const user = await usersService.assignRoleToUser(id, payload, actorUserId);

  res.status(HTTP_STATUS.OK).json({
    message: USERS_RESPONSE_MESSAGE.USER_ROLE_ASSIGNED,
    user
  });
});

export const removeRoleFromUser: RequestHandler = asyncHandler(async (req, res) => {
  const actorUserId = requireActorId(req.auth?.userId);
  const { id, roleId } = parseParams(userRoleParamsSchema, req.params);
  const user = await usersService.removeRoleFromUser(id, roleId, actorUserId);

  res.status(HTTP_STATUS.OK).json({
    message: USERS_RESPONSE_MESSAGE.USER_ROLE_REMOVED,
    user
  });
});
