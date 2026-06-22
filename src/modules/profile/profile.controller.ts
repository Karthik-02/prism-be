import type { RequestHandler } from "express";

import { HTTP_STATUS } from "../../config/http.constants";
import { AppError } from "../../lib/app-error";
import { asyncHandler } from "../../lib/async-handler";
import { parseBody } from "../../lib/validate";
import { RBAC_ERROR_MESSAGE } from "../rbac/rbac.constants";
import { PROFILE_RESPONSE_MESSAGE } from "./profile.constants";
import { updateProfileSchema } from "./profile.schema";
import { ProfileService } from "./profile.service";

const profileService = new ProfileService();

export const getProfile: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new AppError(RBAC_ERROR_MESSAGE.AUTH_REQUIRED, HTTP_STATUS.UNAUTHORIZED);
  }

  const profile = await profileService.getProfile(req.auth.userId);

  res.status(HTTP_STATUS.OK).json({
    message: PROFILE_RESPONSE_MESSAGE.PROFILE_FETCHED,
    profile
  });
});

export const updateProfile: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new AppError(RBAC_ERROR_MESSAGE.AUTH_REQUIRED, HTTP_STATUS.UNAUTHORIZED);
  }

  const payload = parseBody(updateProfileSchema, req.body);
  const result = await profileService.updateProfile(req.auth.userId, payload);

  res.status(HTTP_STATUS.OK).json({
    message: PROFILE_RESPONSE_MESSAGE.PROFILE_UPDATED,
    profile: result.profile,
    requiresVerification: result.requiresVerification,
    notifiedVerifierCount: result.notifiedVerifierCount
  });
});
