import { Router } from "express";

import { HTTP_STATUS } from "../config/http.constants";
import { ROUTE_PATH } from "../config/routes.constants";
import { rbacGuard } from "../middlewares/auth.middleware";
import { RouteAccessLevel } from "../modules/rbac/rbac.constants";

const healthRouter = Router();

healthRouter.get(ROUTE_PATH.HEALTH, rbacGuard({ access: RouteAccessLevel.PUBLIC }), (_req, res) => {
  res.status(HTTP_STATUS.OK).json({
    status: "ok"
  });
});

export { healthRouter };
