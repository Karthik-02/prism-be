import type { RequestHandler } from "express";

import { AUTH_RESPONSE_MESSAGE, SESSION_COOKIE_MAX_AGE_MS } from "../../config/auth.constants";
import { env } from "../../config/env";
import { HTTP_STATUS } from "../../config/http.constants";
import { AppError } from "../../lib/app-error";
import { asyncHandler } from "../../lib/async-handler";
import { parseBody } from "../../lib/validate";
import { RBAC_ERROR_MESSAGE } from "../rbac/rbac.constants";
import { AuthService } from "./auth.service";
import { logoutSchema, requestOtpSchema, verifyOtpSchema } from "./auth.schema";

const authService = new AuthService();

const cookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE || env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: SESSION_COOKIE_MAX_AGE_MS,
  path: "/"
};

export const requestOtp: RequestHandler = asyncHandler(async (req, res) => {
  const payload = parseBody(requestOtpSchema, req.body);
  const result = await authService.requestOtp(payload);

  res.status(HTTP_STATUS.OK).json(result);
});

export const verifyOtp: RequestHandler = asyncHandler(async (req, res) => {
  const payload = parseBody(verifyOtpSchema, req.body);
  const result = await authService.verifyOtp(payload);

  res.cookie(env.JWT_COOKIE_NAME, result.token, cookieOptions);

  res.status(HTTP_STATUS.OK).json({
    message: AUTH_RESPONSE_MESSAGE.OTP_VERIFIED,
    user: result.user,
    session: {
      id: result.session.id,
      expiresAt: result.session.expiresAt,
      rotatedSessionCount: result.session.rotatedSessionCount
    }
  });
});

export const logout: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new AppError(RBAC_ERROR_MESSAGE.AUTH_REQUIRED, HTTP_STATUS.UNAUTHORIZED);
  }

  const payload = parseBody(logoutSchema, req.body ?? {});
  const result = await authService.logout({
    userId: req.auth.userId,
    sessionTokenId: req.auth.sessionTokenId,
    scope: payload.scope
  });

  res.clearCookie(env.JWT_COOKIE_NAME, {
    ...cookieOptions,
    maxAge: 0
  });

  res.status(HTTP_STATUS.OK).json({
    message: AUTH_RESPONSE_MESSAGE.LOGOUT_SUCCESS,
    userId: req.auth.userId,
    scope: result.scope,
    revokedSessionCount: result.revokedSessionCount
  });
});
