import type { RequestHandler } from "express";

import { asyncHandler } from "../../lib/async-handler";
import { listNotificationLogs } from "./notification.service";

const resolveLimit = (value: unknown): number => {
  if (Array.isArray(value)) {
    value = value[0];
  }

  if (typeof value !== "string" && typeof value !== "number") {
    return 15;
  }

  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    return 15;
  }

  return Math.max(1, Math.min(parsed, 50));
};

const formatRecipient = (firstName?: string, lastName?: string) => {
  const fullName = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  return fullName || "Unknown";
};

export const getNotifications: RequestHandler = asyncHandler(async (req, res) => {
  const limit = resolveLimit(req.query.limit);
  const logs = await listNotificationLogs(limit);

  res.json(
    logs.map((log) => ({
      id: log.id,
      eventType: log.eventType,
      recipient: formatRecipient(log.recipient?.firstName, log.recipient?.lastName),
      status: log.status,
      createdAt: log.createdAt.toISOString()
    }))
  );
});
