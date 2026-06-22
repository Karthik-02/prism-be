import { Router } from "express";

import { PERMISSION_KEY } from "../../config/permissions";
import { ROUTE_PATH } from "../../config/routes.constants";
import { rbacGuard } from "../../middlewares/auth.middleware";
import { RouteAccessLevel } from "../rbac/rbac.constants";
import {
  assignPrReviewer,
  createPr,
  listPrs,
  updatePrReleaseMode,
  updatePrStatus
} from "./prs.controller";

const prsRouter = Router();

prsRouter.post(
  ROUTE_PATH.PRS_ROOT,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissions: [PERMISSION_KEY.CAN_CREATE_PR]
  }),
  createPr
);

prsRouter.get(
  ROUTE_PATH.PRS_ROOT,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE
  }),
  listPrs
);

prsRouter.patch(
  ROUTE_PATH.PRS_UPDATE_STATUS,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissions: [PERMISSION_KEY.CAN_REVIEW_PR]
  }),
  updatePrStatus
);

prsRouter.patch(
  ROUTE_PATH.PRS_ASSIGN,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissions: [PERMISSION_KEY.CAN_ASSIGN_PR]
  }),
  assignPrReviewer
);

prsRouter.patch(
  ROUTE_PATH.PRS_UPDATE_RELEASE_MODE,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissions: [PERMISSION_KEY.CAN_CREATE_PR]
  }),
  updatePrReleaseMode
);

export { prsRouter };
