import { Router } from "express";

import { PERMISSION_KEY } from "../../config/permissions";
import { ROUTE_PATH } from "../../config/routes.constants";
import { rbacGuard } from "../../middlewares/auth.middleware";
import { RouteAccessLevel } from "../rbac/rbac.constants";
import {
  addPrToRelease,
  createRelease,
  deleteRelease,
  getReleaseDetail,
  listReleases,
  removePrFromRelease,
  updateRelease,
  updateReleaseDate
} from "./releases.controller";

const releasesRouter = Router();

const RELEASE_LIST_PERMISSIONS = [
  PERMISSION_KEY.CAN_CREATE_PR,
  PERMISSION_KEY.CAN_VIEW_ALL_PRS,
  PERMISSION_KEY.CAN_MANAGE_RELEASE,
  PERMISSION_KEY.CAN_SET_PROD_RELEASE_DATE,
  PERMISSION_KEY.CAN_GENERATE_OWN_RELEASE_NOTES,
  PERMISSION_KEY.CAN_GENERATE_FULL_RELEASE_NOTES
] as const;

const RELEASE_DETAIL_PERMISSIONS = [
  PERMISSION_KEY.CAN_MANAGE_RELEASE,
  PERMISSION_KEY.CAN_SET_PROD_RELEASE_DATE,
  PERMISSION_KEY.CAN_GENERATE_OWN_RELEASE_NOTES,
  PERMISSION_KEY.CAN_GENERATE_FULL_RELEASE_NOTES
] as const;

releasesRouter.post(
  ROUTE_PATH.RELEASES_ROOT,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissions: [PERMISSION_KEY.CAN_MANAGE_RELEASE]
  }),
  createRelease
);

releasesRouter.get(
  ROUTE_PATH.RELEASES_ROOT,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissionsAny: [...RELEASE_LIST_PERMISSIONS]
  }),
  listReleases
);

releasesRouter.get(
  ROUTE_PATH.RELEASES_DETAIL,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissionsAny: [...RELEASE_DETAIL_PERMISSIONS]
  }),
  getReleaseDetail
);

releasesRouter.post(
  ROUTE_PATH.RELEASES_ADD_PR,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissions: [PERMISSION_KEY.CAN_MANAGE_RELEASE]
  }),
  addPrToRelease
);

releasesRouter.delete(
  ROUTE_PATH.RELEASES_REMOVE_PR,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissions: [PERMISSION_KEY.CAN_MANAGE_RELEASE]
  }),
  removePrFromRelease
);

releasesRouter.patch(
  ROUTE_PATH.RELEASES_UPDATE,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissions: [PERMISSION_KEY.CAN_MANAGE_RELEASE]
  }),
  updateRelease
);

releasesRouter.patch(
  ROUTE_PATH.RELEASES_UPDATE_DATE,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissions: [PERMISSION_KEY.CAN_SET_PROD_RELEASE_DATE]
  }),
  updateReleaseDate
);

releasesRouter.delete(
  ROUTE_PATH.RELEASES_BY_ID,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissions: [PERMISSION_KEY.CAN_MANAGE_RELEASE]
  }),
  deleteRelease
);

export { releasesRouter };
