import type { RequestHandler } from "express";

import { asyncHandler } from "../../lib/async-handler";
import { listAuditLogs } from "./audit.service";

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

const formatPerformer = (firstName?: string, lastName?: string) => {
  const fullName = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  return fullName || "System";
};

export const getAuditLogs: RequestHandler = asyncHandler(async (req, res) => {
  const limit = resolveLimit(req.query.limit);
  const logs = await listAuditLogs(limit);

  res.json(
    logs.map((log) => ({
      id: log.id,
      entityType: log.entityType,
      action: log.action,
      performedBy: formatPerformer(log.performer?.firstName, log.performer?.lastName),
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString()
    }))
  );
});
