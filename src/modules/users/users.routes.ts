import { Router } from "express";

import { PERMISSION_KEY } from "../../config/permissions";
import { ROUTE_PATH } from "../../config/routes.constants";
import { rbacGuard } from "../../middlewares/auth.middleware";
import { RouteAccessLevel } from "../rbac/rbac.constants";
import {
  approveUser,
  assignRoleToUser,
  createUser,
  disapproveUser,
  listUserDirectory,
  listUsers,
  removeRoleFromUser
} from "./users.controller";

const usersRouter = Router();

usersRouter.post(
  ROUTE_PATH.USERS_ROOT,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissions: [PERMISSION_KEY.CAN_CREATE_USER]
  }),
  createUser
);

usersRouter.get(
  ROUTE_PATH.USERS_DIRECTORY,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE
  }),
  listUserDirectory
);

usersRouter.get(
  ROUTE_PATH.USERS_ROOT,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissionsAny: [
      PERMISSION_KEY.CAN_CREATE_USER,
      PERMISSION_KEY.CAN_VERIFY_USERS,
      PERMISSION_KEY.CAN_ASSIGN_ROLE
    ]
  }),
  listUsers
);

usersRouter.post(
  ROUTE_PATH.USERS_APPROVE,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissions: [PERMISSION_KEY.CAN_VERIFY_USERS]
  }),
  approveUser
);

usersRouter.post(
  ROUTE_PATH.USERS_DISAPPROVE,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissions: [PERMISSION_KEY.CAN_VERIFY_USERS]
  }),
  disapproveUser
);

usersRouter.post(
  ROUTE_PATH.USERS_ASSIGN_ROLE,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissions: [PERMISSION_KEY.CAN_ASSIGN_ROLE]
  }),
  assignRoleToUser
);

usersRouter.delete(
  ROUTE_PATH.USERS_REMOVE_ROLE,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissions: [PERMISSION_KEY.CAN_ASSIGN_ROLE]
  }),
  removeRoleFromUser
);

export { usersRouter };
