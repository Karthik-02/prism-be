import { DomainStatus } from "@prisma/client";
import { z } from "zod";

import { EMAIL_DOMAINS_ERROR_MESSAGE } from "./email-domains.constants";

const DOMAIN_PATTERN = /^(?=.{1,255}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(DOMAIN_PATTERN, EMAIL_DOMAINS_ERROR_MESSAGE.INVALID_DOMAIN_FORMAT);

export const createEmailDomainSchema = z.object({
  domain: domainSchema,
  status: z.nativeEnum(DomainStatus).default(DomainStatus.ACTIVE)
});

export const updateEmailDomainStatusSchema = z.object({
  status: z.nativeEnum(DomainStatus)
});

export const emailDomainIdParamsSchema = z.object({
  id: z.string().uuid()
});

export type CreateEmailDomainInput = z.infer<typeof createEmailDomainSchema>;
export type UpdateEmailDomainStatusInput = z.infer<typeof updateEmailDomainStatusSchema>;
export type EmailDomainIdParamsInput = z.infer<typeof emailDomainIdParamsSchema>;
