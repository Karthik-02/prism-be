import { z } from "zod";

import { VALIDATION_LIMITS } from "../../config/validation.constants";
import { PROFILE_ERROR_MESSAGE } from "./profile.constants";

export const updateProfileSchema = z
  .object({
    firstName: z.string().trim().min(1).max(VALIDATION_LIMITS.NAME_MAX_LENGTH).optional(),
    lastName: z.string().trim().min(1).max(VALIDATION_LIMITS.NAME_MAX_LENGTH).optional(),
    email: z.string().trim().email().optional(),
    githubUserId: z
      .string()
      .trim()
      .min(1)
      .max(VALIDATION_LIMITS.GITHUB_USER_ID_MAX_LENGTH)
      .optional()
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: PROFILE_ERROR_MESSAGE.AT_LEAST_ONE_FIELD_REQUIRED
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
