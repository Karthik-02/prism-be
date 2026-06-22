import { Router } from "express";

import { ROUTE_PATH } from "../config/routes.constants";
import { authRouter } from "../modules/auth/auth.routes";
import { auditRouter } from "../modules/audit/audit.routes";
import { emailDomainsRouter } from "../modules/email-domains/email-domains.routes";
import { notificationsRouter } from "../modules/notifications/notifications.routes";
import { profileRouter } from "../modules/profile/profile.routes";
import { prsRouter } from "../modules/prs/prs.routes";
import { releaseNotesRouter } from "../modules/release-notes/release-notes.routes";
import { releasesRouter } from "../modules/releases/releases.routes";
import { rolesRouter } from "../modules/roles/roles.routes";
import { usersRouter } from "../modules/users/users.routes";
import { healthRouter } from "./health.routes";

const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(ROUTE_PATH.AUTH, authRouter);
apiRouter.use(ROUTE_PATH.PROFILE, profileRouter);
apiRouter.use(ROUTE_PATH.USERS, usersRouter);
apiRouter.use(ROUTE_PATH.ROLES, rolesRouter);
apiRouter.use(ROUTE_PATH.EMAIL_DOMAINS, emailDomainsRouter);
apiRouter.use(ROUTE_PATH.PRS, prsRouter);
apiRouter.use(ROUTE_PATH.AUDIT_LOGS, auditRouter);
apiRouter.use(ROUTE_PATH.RELEASES, releasesRouter);
apiRouter.use(ROUTE_PATH.RELEASE_NOTES, releaseNotesRouter);
apiRouter.use(ROUTE_PATH.NOTIFICATIONS, notificationsRouter);

export { apiRouter };
