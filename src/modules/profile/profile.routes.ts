import { Router } from "express";

import { ROUTE_PATH } from "../../config/routes.constants";
import { rbacGuard } from "../../middlewares/auth.middleware";
import { RouteAccessLevel } from "../rbac/rbac.constants";
import { getProfile, updateProfile } from "./profile.controller";

const profileRouter = Router();

profileRouter.get(
  ROUTE_PATH.PROFILE_ROOT,
  rbacGuard({ access: RouteAccessLevel.AUTHENTICATED }),
  getProfile
);

profileRouter.put(
  ROUTE_PATH.PROFILE_ROOT,
  rbacGuard({ access: RouteAccessLevel.AUTHENTICATED }),
  updateProfile
);

export { profileRouter };
