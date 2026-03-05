import { z } from "zod";

import { VALIDATION_LIMITS } from "../../config/validation.constants";

export const requestOtpSchema = z.object({
  email: z.string().email()
});

export const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().min(VALIDATION_LIMITS.OTP_MIN_LENGTH).max(VALIDATION_LIMITS.OTP_MAX_LENGTH),
  firstName: z.string().min(1).max(VALIDATION_LIMITS.NAME_MAX_LENGTH).optional(),
  lastName: z.string().min(1).max(VALIDATION_LIMITS.NAME_MAX_LENGTH).optional(),
  githubUserId: z.string().min(1).max(VALIDATION_LIMITS.GITHUB_USER_ID_MAX_LENGTH).optional()
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
