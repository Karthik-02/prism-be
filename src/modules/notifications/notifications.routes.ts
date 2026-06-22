import { Router } from "express";

import { PERMISSION_KEY } from "../../config/permissions";
import { ROUTE_PATH } from "../../config/routes.constants";
import { rbacGuard } from "../../middlewares/auth.middleware";
import { RouteAccessLevel } from "../rbac/rbac.constants";
import { getNotifications } from "./notifications.controller";

const notificationsRouter = Router();

notificationsRouter.get(
  ROUTE_PATH.NOTIFICATIONS_ROOT,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissionsAny: [
      PERMISSION_KEY.CAN_MANAGE_RELEASE,
      PERMISSION_KEY.CAN_MANAGE_ROLES
    ]
  }),
  getNotifications
);

export { notificationsRouter };
