import { Router } from "express";

import { ROUTE_PATH } from "../../config/routes.constants";
import { rbacGuard } from "../../middlewares/auth.middleware";
import { RouteAccessLevel } from "../rbac/rbac.constants";
import { logout, requestOtp, verifyOtp } from "./auth.controller";

const authRouter = Router();

authRouter.post(ROUTE_PATH.AUTH_REQUEST_OTP, rbacGuard({ access: RouteAccessLevel.PUBLIC }), requestOtp);
authRouter.post(ROUTE_PATH.AUTH_VERIFY_OTP, rbacGuard({ access: RouteAccessLevel.PUBLIC }), verifyOtp);
authRouter.post(
  ROUTE_PATH.AUTH_LOGOUT,
  rbacGuard({ access: RouteAccessLevel.AUTHENTICATED }),
  logout
);

export { authRouter };
