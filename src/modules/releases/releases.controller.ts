import type { RequestHandler } from "express";

import { PERMISSION_KEY } from "../../config/permissions";
import { HTTP_STATUS } from "../../config/http.constants";
import { AppError } from "../../lib/app-error";
import { asyncHandler } from "../../lib/async-handler";
import { parseBody, parseParams, parseQuery } from "../../lib/validate";
import { RBAC_ERROR_MESSAGE } from "../rbac/rbac.constants";
import { RELEASE_RESPONSE_MESSAGE } from "./releases.constants";
import {
  addPrToReleaseSchema,
  createReleaseSchema,
  listReleasesQuerySchema,
  releaseIdParamsSchema,
  updateReleaseDateSchema,
  updateReleaseSchema
} from "./releases.schema";
import { ReleasesService } from "./releases.service";

const releasesService = new ReleasesService();

const requireActorId = (actorUserId: string | undefined): string => {
  if (!actorUserId) {
    throw new AppError(RBAC_ERROR_MESSAGE.AUTH_REQUIRED, HTTP_STATUS.UNAUTHORIZED);
  }

  return actorUserId;
};

export const createRelease: RequestHandler = asyncHandler(async (req, res) => {
  const actorUserId = requireActorId(req.auth?.userId);
  const payload = parseBody(createReleaseSchema, req.body);
  const release = await releasesService.createRelease(payload, actorUserId);

  res.status(HTTP_STATUS.OK).json({
    message: RELEASE_RESPONSE_MESSAGE.RELEASE_CREATED,
    release
  });
});

export const listReleases: RequestHandler = asyncHandler(async (req, res) => {
  const query = parseQuery(listReleasesQuerySchema, req.query);
  const releases = await releasesService.listReleases(query);

  res.status(HTTP_STATUS.OK).json({
    message: RELEASE_RESPONSE_MESSAGE.RELEASES_FETCHED,
    releases
  });
});

export const getReleaseDetail: RequestHandler = asyncHandler(async (req, res) => {
  const { id } = parseParams(releaseIdParamsSchema, req.params);
  const release = await releasesService.getReleaseDetail(id);

  res.status(HTTP_STATUS.OK).json({
    message: RELEASE_RESPONSE_MESSAGE.RELEASES_FETCHED,
    release
  });
});

export const addPrToRelease: RequestHandler = asyncHandler(async (req, res) => {
  const actorUserId = requireActorId(req.auth?.userId);
  const { id } = parseParams(releaseIdParamsSchema, req.params);
  const payload = parseBody(addPrToReleaseSchema, req.body);
  await releasesService.addPrToRelease(id, payload, actorUserId);

  res.status(HTTP_STATUS.OK).json({
    message: RELEASE_RESPONSE_MESSAGE.RELEASE_PR_ADDED
  });
});

export const removePrFromRelease: RequestHandler = asyncHandler(async (req, res) => {
  const actorUserId = requireActorId(req.auth?.userId);
  const { id } = parseParams(releaseIdParamsSchema, req.params);
  const prId = parseBody(addPrToReleaseSchema, req.body).prId;
  await releasesService.removePrFromRelease(id, prId, actorUserId);

  res.status(HTTP_STATUS.OK).json({
    message: RELEASE_RESPONSE_MESSAGE.RELEASE_PR_REMOVED
  });
});

export const updateRelease: RequestHandler = asyncHandler(async (req, res) => {
  const actorUserId = requireActorId(req.auth?.userId);
  const { id } = parseParams(releaseIdParamsSchema, req.params);
  const payload = parseBody(updateReleaseSchema, req.body);
  const release = await releasesService.updateRelease(id, payload, actorUserId);

  res.status(HTTP_STATUS.OK).json({
    message: RELEASE_RESPONSE_MESSAGE.RELEASE_UPDATED,
    release
  });
});

export const updateReleaseDate: RequestHandler = asyncHandler(async (req, res) => {
  const actorUserId = requireActorId(req.auth?.userId);
  const { id } = parseParams(releaseIdParamsSchema, req.params);
  const payload = parseBody(updateReleaseDateSchema, req.body);
  const release = await releasesService.updateReleaseDate(id, payload, actorUserId);

  res.status(HTTP_STATUS.OK).json({
    message: RELEASE_RESPONSE_MESSAGE.RELEASE_DATE_SET,
    release
  });
});

export const deleteRelease: RequestHandler = asyncHandler(async (req, res) => {
  const actorUserId = requireActorId(req.auth?.userId);
  const { id } = parseParams(releaseIdParamsSchema, req.params);
  await releasesService.deleteRelease(id, actorUserId);

  res.status(HTTP_STATUS.OK).json({
    message: RELEASE_RESPONSE_MESSAGE.RELEASE_DELETED
  });
});
