import { Router } from "express";

import { PERMISSION_KEY } from "../../config/permissions";
import { ROUTE_PATH } from "../../config/routes.constants";
import { rbacGuard } from "../../middlewares/auth.middleware";
import { RouteAccessLevel } from "../rbac/rbac.constants";
import {
  createEmailDomain,
  deleteEmailDomain,
  listEmailDomains,
  updateEmailDomainStatus
} from "./email-domains.controller";

const emailDomainsRouter = Router();

emailDomainsRouter.post(
  ROUTE_PATH.EMAIL_DOMAINS_ROOT,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissions: [PERMISSION_KEY.CAN_MANAGE_EMAIL_DOMAIN]
  }),
  createEmailDomain
);

emailDomainsRouter.get(
  ROUTE_PATH.EMAIL_DOMAINS_ROOT,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissions: [PERMISSION_KEY.CAN_MANAGE_EMAIL_DOMAIN]
  }),
  listEmailDomains
);

emailDomainsRouter.delete(
  ROUTE_PATH.EMAIL_DOMAINS_BY_ID,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissions: [PERMISSION_KEY.CAN_MANAGE_EMAIL_DOMAIN]
  }),
  deleteEmailDomain
);

emailDomainsRouter.patch(
  ROUTE_PATH.EMAIL_DOMAINS_UPDATE_STATUS,
  rbacGuard({
    access: RouteAccessLevel.ACTIVE,
    requiredPermissions: [PERMISSION_KEY.CAN_MANAGE_EMAIL_DOMAIN]
  }),
  updateEmailDomainStatus
);

export { emailDomainsRouter };
