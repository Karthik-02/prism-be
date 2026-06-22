import { ReleaseNoteScope } from "@prisma/client";
import type { RequestHandler } from "express";

import { HTTP_STATUS } from "../../config/http.constants";
import { AppError } from "../../lib/app-error";
import { asyncHandler } from "../../lib/async-handler";
import { parseBody, parseParams, parseQuery } from "../../lib/validate";
import { RBAC_ERROR_MESSAGE } from "../rbac/rbac.constants";
import { RELEASE_NOTES_RESPONSE_MESSAGE } from "./release-notes.constants";
import {
  releaseNoteParamsSchema,
  releaseNoteQuerySchema,
  updateReleaseNotesSchema
} from "./release-notes.schema";
import { ReleaseNotesService } from "./release-notes.service";

const releaseNotesService = new ReleaseNotesService();

const requireActorId = (actorUserId: string | undefined): string => {
  if (!actorUserId) {
    throw new AppError(RBAC_ERROR_MESSAGE.AUTH_REQUIRED, HTTP_STATUS.UNAUTHORIZED);
  }
  return actorUserId;
};

export const getMyReleaseNotes: RequestHandler = asyncHandler(async (req, res) => {
  const actorUserId = requireActorId(req.auth?.userId);
  const { releaseId } = parseQuery(releaseNoteQuerySchema, req.query);
  const releaseNote = await releaseNotesService.getOwnReleaseNotes(releaseId, actorUserId);

  res.status(HTTP_STATUS.OK).json({
    message: RELEASE_NOTES_RESPONSE_MESSAGE.RELEASE_NOTES_FETCHED,
    releaseNote
  });
});

export const getFullReleaseNotes: RequestHandler = asyncHandler(async (req, res) => {
  const actorUserId = requireActorId(req.auth?.userId);
  const { releaseId } = parseParams(releaseNoteParamsSchema, req.params);
  const releaseNote = await releaseNotesService.getFullReleaseNotes(releaseId, actorUserId);

  res.status(HTTP_STATUS.OK).json({
    message: RELEASE_NOTES_RESPONSE_MESSAGE.RELEASE_NOTES_FETCHED,
    releaseNote
  });
});

export const updateMyReleaseNotes: RequestHandler = asyncHandler(async (req, res) => {
  const actorUserId = requireActorId(req.auth?.userId);
  const { releaseId } = parseQuery(releaseNoteQuerySchema, req.query);
  const payload = parseBody(updateReleaseNotesSchema, req.body);
  const releaseNote = await releaseNotesService.updateReleaseNotes(
    releaseId,
    ReleaseNoteScope.OWN,
    actorUserId,
    payload,
    actorUserId
  );

  res.status(HTTP_STATUS.OK).json({
    message: RELEASE_NOTES_RESPONSE_MESSAGE.RELEASE_NOTES_UPDATED,
    releaseNote
  });
});

export const updateFullReleaseNotes: RequestHandler = asyncHandler(async (req, res) => {
  const actorUserId = requireActorId(req.auth?.userId);
  const { releaseId } = parseParams(releaseNoteParamsSchema, req.params);
  const payload = parseBody(updateReleaseNotesSchema, req.body);
  const releaseNote = await releaseNotesService.updateReleaseNotes(
    releaseId,
    ReleaseNoteScope.FULL,
    null,
    payload,
    actorUserId
  );

  res.status(HTTP_STATUS.OK).json({
    message: RELEASE_NOTES_RESPONSE_MESSAGE.RELEASE_NOTES_UPDATED,
    releaseNote
  });
});
