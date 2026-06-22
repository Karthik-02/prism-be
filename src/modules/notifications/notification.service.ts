import { NotificationLog, NotificationStatus, type Prisma, type PrismaClient } from "@prisma/client";

import { LOG_CONTEXT } from "../../config/log.constants";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import type { NotificationEvent } from "./notification.constants";

type PrismaClientLike = PrismaClient | Prisma.TransactionClient;

export interface LogNotificationOutcomesInput {
  eventType: NotificationEvent;
  recipientIds: string[];
}

const deduplicateRecipientIds = (recipientIds: string[]): string[] => [...new Set(recipientIds)];

export const logNotificationOutcomes = async (
  input: LogNotificationOutcomesInput,
  prismaClient: PrismaClientLike
): Promise<number> => {
  const uniqueRecipientIds = deduplicateRecipientIds(input.recipientIds);

  if (!uniqueRecipientIds.length) {
    return 0;
  }

  let createdCount = 0;

  for (const recipientId of uniqueRecipientIds) {
    await prismaClient.notificationLog.create({
      data: {
        eventType: input.eventType,
        recipientId,
        status: NotificationStatus.SENT
      }
    });

    createdCount += 1;
  }

  logger.info("Notification outcomes logged", {
    context: LOG_CONTEXT.NOTIFICATION,
    eventType: input.eventType,
    recipientCount: createdCount
  });

  return createdCount;
};

export const listNotificationLogs = async (limit = 15): Promise<NotificationLog[]> => {
  const resolvedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 50)) : 15;

  return prisma.notificationLog.findMany({
    take: resolvedLimit,
    orderBy: {
      createdAt: "desc"
    },
    include: {
      recipient: {
        select: {
          firstName: true,
          lastName: true
        }
      }
    }
  });
};
