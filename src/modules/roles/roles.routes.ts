import { Router } from "express";

import { PERMISSION_KEY } from "../../config/permissions";
import { ROUTE_PATH } from "../../config/routes.constants";
import { rbacGuard } from "../../middlewares/auth.middleware";
import { RouteAccessLevel } from "../rbac/rbac.constants";
import {
  assignPermissionToRole,
  createRole,
  deleteRole,
  listRoles,
  removePermissionFromRole,
  updateRole
} from "./roles.controller";

const rolesRouter = Router();

rolesRouter.post(
  ROUTE_PATH.ROLES_ROOT,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissions: [PERMISSION_KEY.CAN_MANAGE_ROLES]
  }),
  createRole
);

rolesRouter.get(
  ROUTE_PATH.ROLES_ROOT,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissionsAny: [
      PERMISSION_KEY.CAN_MANAGE_ROLES,
      PERMISSION_KEY.CAN_MANAGE_PERMISSIONS,
      PERMISSION_KEY.CAN_ASSIGN_ROLE
    ]
  }),
  listRoles
);

rolesRouter.put(
  ROUTE_PATH.ROLES_BY_ID,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissions: [PERMISSION_KEY.CAN_MANAGE_ROLES]
  }),
  updateRole
);

rolesRouter.delete(
  ROUTE_PATH.ROLES_BY_ID,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissions: [PERMISSION_KEY.CAN_MANAGE_ROLES]
  }),
  deleteRole
);

rolesRouter.post(
  ROUTE_PATH.ROLES_ASSIGN_PERMISSION,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissions: [PERMISSION_KEY.CAN_MANAGE_PERMISSIONS]
  }),
  assignPermissionToRole
);

rolesRouter.delete(
  ROUTE_PATH.ROLES_REMOVE_PERMISSION,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissions: [PERMISSION_KEY.CAN_MANAGE_PERMISSIONS]
  }),
  removePermissionFromRole
);

export { rolesRouter };
