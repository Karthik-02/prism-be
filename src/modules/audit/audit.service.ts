import type { Prisma, PrismaClient } from "@prisma/client";

import { env } from "../../config/env";
import { HTTP_STATUS } from "../../config/http.constants";
import { LOG_CONTEXT } from "../../config/log.constants";
import { AppError } from "../../lib/app-error";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { AUDIT_ERROR_MESSAGE, type AuditAction, type AuditEntity } from "./audit.constants";

type PrismaClientLike = PrismaClient | Prisma.TransactionClient;

export interface CreateAuditLogInput {
  entityType: AuditEntity;
  entityId: string;
  action: AuditAction;
  performedBy?: string;
  metadata?: Prisma.InputJsonValue;
}

const resolveAuditActorId = async (
  performedBy: string | undefined,
  prismaClient: PrismaClientLike
): Promise<string> => {
  if (performedBy) {
    return performedBy;
  }

  const systemUser = await prismaClient.user.findUnique({
    where: {
      email: env.SYSTEM_ACTOR_EMAIL
    },
    select: {
      id: true
    }
  });

  if (!systemUser) {
    logger.error("System actor user missing for audit logging", {
      context: LOG_CONTEXT.AUDIT,
      systemActorEmail: env.SYSTEM_ACTOR_EMAIL
    });

    throw new AppError(AUDIT_ERROR_MESSAGE.SYSTEM_ACTOR_MISSING, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }

  return systemUser.id;
};

export const createAuditLog = async (
  input: CreateAuditLogInput,
  prismaClient: PrismaClientLike = prisma
): Promise<void> => {
  const actorId = await resolveAuditActorId(input.performedBy, prismaClient);

  await prismaClient.auditLog.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      performedBy: actorId,
      metadata: input.metadata
    }
  });

  logger.debug("Audit log created", {
    context: LOG_CONTEXT.AUDIT,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    actorId
  });
};
