import { UserStatus, type UserStatus as UserStatusType } from "@prisma/client";
import type { Request, RequestHandler } from "express";

import type { PermissionKey } from "../config/permissions";
import { env } from "../config/env";
import { HTTP_STATUS } from "../config/http.constants";
import { LOG_CONTEXT } from "../config/log.constants";
import { AppError } from "../lib/app-error";
import { asyncHandler } from "../lib/async-handler";
import { verifyAuthToken } from "../lib/jwt";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { RouteAccessLevel, RBAC_ERROR_MESSAGE } from "../modules/rbac/rbac.constants";
import { resolveUserPermissionSet } from "../modules/rbac/rbac.service";

export interface RbacPolicy {
  access: RouteAccessLevel;
  requiredPermissions?: PermissionKey[];
  allowedStatuses?: UserStatusType[];
}

const attachAuthContext = async (token: string, req: Request): Promise<void> => {
  const payload = verifyAuthToken(token);
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });

  if (!user) {
    logger.warn("RBAC auth failed: user not found", {
      context: LOG_CONTEXT.RBAC,
      userIdFromToken: payload.sub,
      path: req.originalUrl
    });

    throw new AppError(RBAC_ERROR_MESSAGE.AUTH_REQUIRED, HTTP_STATUS.UNAUTHORIZED);
  }

  if (user.status === UserStatus.INACTIVE) {
    logger.warn("RBAC auth failed: inactive user", {
      context: LOG_CONTEXT.RBAC,
      userId: user.id,
      path: req.originalUrl
    });

    throw new AppError(RBAC_ERROR_MESSAGE.INACTIVE_USER_ACCESS_BLOCKED, HTTP_STATUS.FORBIDDEN);
  }

  const permissions = await resolveUserPermissionSet(user.id);

  req.auth = {
    userId: user.id,
    email: user.email,
    status: user.status,
    permissions
  };
};

export const rbacGuard = (policy: RbacPolicy): RequestHandler =>
  asyncHandler(async (req, _res, next) => {
    if (policy.access === RouteAccessLevel.PUBLIC) {
      next();
      return;
    }

    const token = req.cookies?.[env.JWT_COOKIE_NAME];

    if (!token) {
      logger.warn("RBAC auth failed: missing token", {
        context: LOG_CONTEXT.RBAC,
        path: req.originalUrl
      });

      throw new AppError(RBAC_ERROR_MESSAGE.AUTH_REQUIRED, HTTP_STATUS.UNAUTHORIZED);
    }

    await attachAuthContext(token, req);

    if (!req.auth) {
      logger.warn("RBAC auth failed: auth context missing after token verification", {
        context: LOG_CONTEXT.RBAC,
        path: req.originalUrl
      });

      throw new AppError(RBAC_ERROR_MESSAGE.AUTH_REQUIRED, HTTP_STATUS.UNAUTHORIZED);
    }

    if (policy.access === RouteAccessLevel.ACTIVE && req.auth.status !== UserStatus.ACTIVE) {
      logger.warn("RBAC auth failed: ACTIVE-only route status mismatch", {
        context: LOG_CONTEXT.RBAC,
        path: req.originalUrl,
        userId: req.auth.userId,
        status: req.auth.status
      });

      throw new AppError(RBAC_ERROR_MESSAGE.STATUS_NOT_ALLOWED, HTTP_STATUS.FORBIDDEN);
    }

    if (policy.allowedStatuses && !policy.allowedStatuses.includes(req.auth.status)) {
      logger.warn("RBAC auth failed: status not in allowed list", {
        context: LOG_CONTEXT.RBAC,
        path: req.originalUrl,
        userId: req.auth.userId,
        status: req.auth.status,
        allowedStatuses: policy.allowedStatuses
      });

      throw new AppError(RBAC_ERROR_MESSAGE.STATUS_NOT_ALLOWED, HTTP_STATUS.FORBIDDEN);
    }

    if (policy.requiredPermissions?.length) {
      const hasAllPermissions = policy.requiredPermissions.every((permission) =>
        req.auth?.permissions.has(permission)
      );

      if (!hasAllPermissions) {
        logger.warn("RBAC auth failed: missing required permissions", {
          context: LOG_CONTEXT.RBAC,
          path: req.originalUrl,
          userId: req.auth.userId,
          requiredPermissions: policy.requiredPermissions
        });

        throw new AppError(RBAC_ERROR_MESSAGE.FORBIDDEN, HTTP_STATUS.FORBIDDEN);
      }
    }

    next();
  });

export const authenticate = rbacGuard({ access: RouteAccessLevel.AUTHENTICATED });
