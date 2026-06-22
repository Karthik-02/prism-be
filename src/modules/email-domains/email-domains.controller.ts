import type { RequestHandler } from "express";

import { HTTP_STATUS } from "../../config/http.constants";
import { AppError } from "../../lib/app-error";
import { asyncHandler } from "../../lib/async-handler";
import { parseBody, parseParams } from "../../lib/validate";
import { RBAC_ERROR_MESSAGE } from "../rbac/rbac.constants";
import {
  EMAIL_DOMAINS_RESPONSE_MESSAGE
} from "./email-domains.constants";
import {
  createEmailDomainSchema,
  emailDomainIdParamsSchema,
  updateEmailDomainStatusSchema
} from "./email-domains.schema";
import { EmailDomainsService } from "./email-domains.service";

const emailDomainsService = new EmailDomainsService();

const requireActorId = (actorUserId: string | undefined): string => {
  if (!actorUserId) {
    throw new AppError(RBAC_ERROR_MESSAGE.AUTH_REQUIRED, HTTP_STATUS.UNAUTHORIZED);
  }

  return actorUserId;
};

export const createEmailDomain: RequestHandler = asyncHandler(async (req, res) => {
  const actorUserId = requireActorId(req.auth?.userId);
  const payload = parseBody(createEmailDomainSchema, req.body);
  const emailDomain = await emailDomainsService.createEmailDomain(payload, actorUserId);

  res.status(HTTP_STATUS.OK).json({
    message: EMAIL_DOMAINS_RESPONSE_MESSAGE.EMAIL_DOMAIN_CREATED,
    emailDomain
  });
});

export const listEmailDomains: RequestHandler = asyncHandler(async (_req, res) => {
  const emailDomains = await emailDomainsService.listEmailDomains();

  res.status(HTTP_STATUS.OK).json({
    message: EMAIL_DOMAINS_RESPONSE_MESSAGE.EMAIL_DOMAINS_FETCHED,
    emailDomains
  });
});

export const deleteEmailDomain: RequestHandler = asyncHandler(async (req, res) => {
  const actorUserId = requireActorId(req.auth?.userId);
  const { id } = parseParams(emailDomainIdParamsSchema, req.params);
  await emailDomainsService.deleteEmailDomain(id, actorUserId);

  res.status(HTTP_STATUS.OK).json({
    message: EMAIL_DOMAINS_RESPONSE_MESSAGE.EMAIL_DOMAIN_DELETED
  });
});

export const updateEmailDomainStatus: RequestHandler = asyncHandler(async (req, res) => {
  const actorUserId = requireActorId(req.auth?.userId);
  const { id } = parseParams(emailDomainIdParamsSchema, req.params);
  const payload = parseBody(updateEmailDomainStatusSchema, req.body);
  const emailDomain = await emailDomainsService.updateEmailDomainStatus(id, payload, actorUserId);

  res.status(HTTP_STATUS.OK).json({
    message: EMAIL_DOMAINS_RESPONSE_MESSAGE.EMAIL_DOMAIN_STATUS_UPDATED,
    emailDomain
  });
});
