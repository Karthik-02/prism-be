import type { RequestHandler } from "express";

import { AUTH_RESPONSE_MESSAGE, SESSION_COOKIE_MAX_AGE_MS } from "../../config/auth.constants";
import { env } from "../../config/env";
import { HTTP_STATUS } from "../../config/http.constants";
import { LOG_CONTEXT } from "../../config/log.constants";
import { asyncHandler } from "../../lib/async-handler";
import { logger } from "../../lib/logger";
import { parseBody } from "../../lib/validate";
import { AuthService } from "./auth.service";
import { requestOtpSchema, verifyOtpSchema } from "./auth.schema";

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
    user: result.user
  });
});

export const logout: RequestHandler = asyncHandler(async (req, res) => {
  logger.info("Logout request completed", {
    context: LOG_CONTEXT.AUTH,
    userId: req.auth?.userId
  });

  res.clearCookie(env.JWT_COOKIE_NAME, {
    ...cookieOptions,
    maxAge: 0
  });

  res.status(HTTP_STATUS.OK).json({
    message: AUTH_RESPONSE_MESSAGE.LOGOUT_SUCCESS
  });
});
