import { Router } from "express";

import { PERMISSION_KEY } from "../../config/permissions";
import { ROUTE_PATH } from "../../config/routes.constants";
import { rbacGuard } from "../../middlewares/auth.middleware";
import { RouteAccessLevel } from "../rbac/rbac.constants";
import {
  getFullReleaseNotes,
  getMyReleaseNotes,
  updateFullReleaseNotes,
  updateMyReleaseNotes
} from "./release-notes.controller";

const releaseNotesRouter = Router();

releaseNotesRouter.get(
  ROUTE_PATH.RELEASE_NOTES_MY,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissions: [PERMISSION_KEY.CAN_GENERATE_OWN_RELEASE_NOTES]
  }),
  getMyReleaseNotes
);

releaseNotesRouter.put(
  ROUTE_PATH.RELEASE_NOTES_MY,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissions: [PERMISSION_KEY.CAN_GENERATE_OWN_RELEASE_NOTES]
  }),
  updateMyReleaseNotes
);

releaseNotesRouter.get(
  ROUTE_PATH.RELEASE_NOTES_BY_RELEASE,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissions: [PERMISSION_KEY.CAN_GENERATE_FULL_RELEASE_NOTES]
  }),
  getFullReleaseNotes
);

releaseNotesRouter.put(
  ROUTE_PATH.RELEASE_NOTES_BY_RELEASE,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissions: [PERMISSION_KEY.CAN_GENERATE_FULL_RELEASE_NOTES]
  }),
  updateFullReleaseNotes
);

export { releaseNotesRouter };
