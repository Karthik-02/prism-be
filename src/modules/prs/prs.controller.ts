import type { RequestHandler } from "express";

import { PERMISSION_KEY } from "../../config/permissions";
import { HTTP_STATUS } from "../../config/http.constants";
import { AppError } from "../../lib/app-error";
import { asyncHandler } from "../../lib/async-handler";
import { parseBody, parseParams, parseQuery } from "../../lib/validate";
import { RBAC_ERROR_MESSAGE } from "../rbac/rbac.constants";
import { PRS_RESPONSE_MESSAGE } from "./prs.constants";
import {
  assignPrReviewerSchema,
  createPrSchema,
  listPrsQuerySchema,
  prIdParamsSchema,
  updatePrReleaseModeSchema,
  updatePrStatusSchema
} from "./prs.schema";
import { PrsService } from "./prs.service";

const prsService = new PrsService();

const requireActorId = (actorUserId: string | undefined): string => {
  if (!actorUserId) {
    throw new AppError(RBAC_ERROR_MESSAGE.AUTH_REQUIRED, HTTP_STATUS.UNAUTHORIZED);
  }

  return actorUserId;
};

export const createPr: RequestHandler = asyncHandler(async (req, res) => {
  const actorUserId = requireActorId(req.auth?.userId);
  const payload = parseBody(createPrSchema, req.body);
  const pr = await prsService.createPr(payload, actorUserId);

  res.status(HTTP_STATUS.OK).json({
    message: PRS_RESPONSE_MESSAGE.PR_CREATED,
    pr
  });
});

export const listPrs: RequestHandler = asyncHandler(async (req, res) => {
  const actorUserId = requireActorId(req.auth?.userId);
  const query = parseQuery(listPrsQuerySchema, req.query);
  const canViewAllPrs = req.auth?.permissions.has(PERMISSION_KEY.CAN_VIEW_ALL_PRS) ?? false;
  const prs = await prsService.listPrs(query, actorUserId, canViewAllPrs);

  res.status(HTTP_STATUS.OK).json({
    message: PRS_RESPONSE_MESSAGE.PRS_FETCHED,
    prs
  });
});

export const updatePrStatus: RequestHandler = asyncHandler(async (req, res) => {
  const actorUserId = requireActorId(req.auth?.userId);
  const { id } = parseParams(prIdParamsSchema, req.params);
  const payload = parseBody(updatePrStatusSchema, req.body);
  const pr = await prsService.updatePrStatus(id, payload, actorUserId);

  res.status(HTTP_STATUS.OK).json({
    message: PRS_RESPONSE_MESSAGE.PR_STATUS_UPDATED,
    pr
  });
});

export const assignPrReviewer: RequestHandler = asyncHandler(async (req, res) => {
  const actorUserId = requireActorId(req.auth?.userId);
  const { id } = parseParams(prIdParamsSchema, req.params);
  const payload = parseBody(assignPrReviewerSchema, req.body);
  const pr = await prsService.assignPrReviewer(id, payload, actorUserId);

  res.status(HTTP_STATUS.OK).json({
    message: PRS_RESPONSE_MESSAGE.PR_ASSIGNED,
    pr
  });
});

export const updatePrReleaseMode: RequestHandler = asyncHandler(async (req, res) => {
  const actorUserId = requireActorId(req.auth?.userId);
  const payload = parseBody(updatePrReleaseModeSchema, req.body);
  const canManageAll = req.auth?.permissions.has(PERMISSION_KEY.CAN_VIEW_ALL_PRS) ?? false;
  const updatedCount = await prsService.updatePrReleaseMode(payload, actorUserId, canManageAll);

  res.status(HTTP_STATUS.OK).json({
    message: PRS_RESPONSE_MESSAGE.PR_RELEASE_MODE_UPDATED,
    updatedCount
  });
});
