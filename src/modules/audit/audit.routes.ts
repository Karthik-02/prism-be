import { Router } from "express";

import { PERMISSION_KEY } from "../../config/permissions";
import { ROUTE_PATH } from "../../config/routes.constants";
import { rbacGuard } from "../../middlewares/auth.middleware";
import { RouteAccessLevel } from "../rbac/rbac.constants";
import { getAuditLogs } from "./audit.controller";

const auditRouter = Router();

auditRouter.get(
  ROUTE_PATH.AUDIT_LOGS_ROOT,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissionsAny: [
      PERMISSION_KEY.CAN_MANAGE_ROLES,
      PERMISSION_KEY.CAN_MANAGE_RELEASE
    ]
  }),
  getAuditLogs
);

export { auditRouter };
