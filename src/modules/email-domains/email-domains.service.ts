import { DomainStatus, type Prisma, type PrismaClient } from "@prisma/client";

import { HTTP_STATUS } from "../../config/http.constants";
import { LOG_CONTEXT } from "../../config/log.constants";
import { AppError } from "../../lib/app-error";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { AUDIT_ACTION, AUDIT_ENTITY } from "../audit/audit.constants";
import { createAuditLog } from "../audit/audit.service";
import { EMAIL_DOMAINS_ERROR_MESSAGE } from "./email-domains.constants";
import type { CreateEmailDomainInput, UpdateEmailDomainStatusInput } from "./email-domains.schema";

type PrismaClientLike = PrismaClient | Prisma.TransactionClient;

interface EmailDomainRecord {
  id: string;
  domain: string;
  status: DomainStatus;
  createdBy: string;
  createdAt: Date;
}

export interface EmailDomainView {
  id: string;
  domain: string;
  status: DomainStatus;
  createdBy: string;
  createdAt: string;
}

const toEmailDomainView = (domainRecord: EmailDomainRecord): EmailDomainView => ({
  id: domainRecord.id,
  domain: domainRecord.domain,
  status: domainRecord.status,
  createdBy: domainRecord.createdBy,
  createdAt: domainRecord.createdAt.toISOString()
});

const getEmailDomainOrThrow = async (
  domainId: string,
  prismaClient: PrismaClientLike
): Promise<EmailDomainRecord> => {
  const domainRecord = await prismaClient.emailDomain.findUnique({
    where: {
      id: domainId
    }
  });

  if (!domainRecord) {
    throw new AppError(EMAIL_DOMAINS_ERROR_MESSAGE.EMAIL_DOMAIN_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  return domainRecord;
};

export class EmailDomainsService {
  async createEmailDomain(input: CreateEmailDomainInput, actorUserId: string): Promise<EmailDomainView> {
    logger.info("Email domain creation requested", {
      context: LOG_CONTEXT.EMAIL_DOMAIN,
      actorUserId,
      domain: input.domain,
      status: input.status
    });

    return prisma.$transaction(async (transactionClient) => {
      const existingDomain = await transactionClient.emailDomain.findUnique({
        where: {
          domain: input.domain
        },
        select: {
          id: true
        }
      });

      if (existingDomain) {
        throw new AppError(
          EMAIL_DOMAINS_ERROR_MESSAGE.EMAIL_DOMAIN_ALREADY_EXISTS,
          HTTP_STATUS.CONFLICT
        );
      }

      const createdDomain = await transactionClient.emailDomain.create({
        data: {
          domain: input.domain,
          status: input.status,
          createdBy: actorUserId
        }
      });

      await createAuditLog(
        {
          entityType: AUDIT_ENTITY.EMAIL_DOMAIN,
          entityId: createdDomain.id,
          action: AUDIT_ACTION.EMAIL_DOMAIN_CREATED,
          performedBy: actorUserId,
          metadata: {
            domain: createdDomain.domain,
            status: createdDomain.status
          }
        },
        transactionClient
      );

      logger.info("Email domain created", {
        context: LOG_CONTEXT.EMAIL_DOMAIN,
        actorUserId,
        emailDomainId: createdDomain.id,
        domain: createdDomain.domain,
        status: createdDomain.status
      });

      return toEmailDomainView(createdDomain);
    });
  }

  async listEmailDomains(): Promise<EmailDomainView[]> {
    const domains = await prisma.emailDomain.findMany({
      orderBy: {
        createdAt: "desc"
      }
    });

    logger.debug("Email domains listed", {
      context: LOG_CONTEXT.EMAIL_DOMAIN,
      totalDomains: domains.length
    });

    return domains.map(toEmailDomainView);
  }

  async deleteEmailDomain(domainId: string, actorUserId: string): Promise<void> {
    logger.info("Email domain deletion requested", {
      context: LOG_CONTEXT.EMAIL_DOMAIN,
      actorUserId,
      emailDomainId: domainId
    });

    await prisma.$transaction(async (transactionClient) => {
      const existingDomain = await getEmailDomainOrThrow(domainId, transactionClient);

      await transactionClient.emailDomain.delete({
        where: {
          id: domainId
        }
      });

      await createAuditLog(
        {
          entityType: AUDIT_ENTITY.EMAIL_DOMAIN,
          entityId: domainId,
          action: AUDIT_ACTION.EMAIL_DOMAIN_DELETED,
          performedBy: actorUserId,
          metadata: {
            domain: existingDomain.domain,
            previousStatus: existingDomain.status
          }
        },
        transactionClient
      );
    });
  }

  async updateEmailDomainStatus(
    domainId: string,
    input: UpdateEmailDomainStatusInput,
    actorUserId: string
  ): Promise<EmailDomainView> {
    logger.info("Email domain status update requested", {
      context: LOG_CONTEXT.EMAIL_DOMAIN,
      actorUserId,
      emailDomainId: domainId,
      nextStatus: input.status
    });

    return prisma.$transaction(async (transactionClient) => {
      const existingDomain = await getEmailDomainOrThrow(domainId, transactionClient);

      const updatedDomain = await transactionClient.emailDomain.update({
        where: {
          id: domainId
        },
        data: {
          status: input.status
        }
      });

      await createAuditLog(
        {
          entityType: AUDIT_ENTITY.EMAIL_DOMAIN,
          entityId: domainId,
          action: AUDIT_ACTION.EMAIL_DOMAIN_STATUS_UPDATED,
          performedBy: actorUserId,
          metadata: {
            domain: existingDomain.domain,
            previousStatus: existingDomain.status,
            nextStatus: updatedDomain.status
          }
        },
        transactionClient
      );

      return toEmailDomainView(updatedDomain);
    });
  }
}
