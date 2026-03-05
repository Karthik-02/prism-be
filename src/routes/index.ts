import { Router } from "express";

import { ROUTE_PATH } from "../config/routes.constants";
import { authRouter } from "../modules/auth/auth.routes";
import { healthRouter } from "./health.routes";

const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(ROUTE_PATH.AUTH, authRouter);

export { apiRouter };
