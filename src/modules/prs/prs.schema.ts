import { PrStatus, PrType, ReleaseEnvironment, ReleaseLinkMode } from "@prisma/client";
import { z } from "zod";

const COMMENTS_MAX_LENGTH = 4000;

const normalizedPrStatusSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
  z.nativeEnum(PrStatus)
);

const normalizedPrTypeSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
  z.nativeEnum(PrType)
);

const normalizedReleaseEnvironmentSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
  z.nativeEnum(ReleaseEnvironment)
);

export const createPrSchema = z.object({
  repo: z.string().trim().min(1).max(255),
  branch: z.string().trim().min(1).max(255),
  prLink: z.string().trim().url(),
  type: z.nativeEnum(PrType),
  reviewerId: z.string().uuid().optional(),
  zohoLink: z.string().trim().url().optional(),
  comments: z.string().trim().max(COMMENTS_MAX_LENGTH).optional(),
  releaseMode: z.nativeEnum(ReleaseLinkMode).optional()
});

export const listPrsQuerySchema = z.object({
  status: normalizedPrStatusSchema.optional(),
  type: normalizedPrTypeSchema.optional(),
  ownerId: z.string().uuid().optional(),
  reviewerId: z.string().uuid().optional(),
  releaseId: z.string().uuid().optional(),
  releaseEnvironment: normalizedReleaseEnvironmentSchema.optional()
});

export const prIdParamsSchema = z.object({
  id: z.string().uuid()
});

export const updatePrStatusSchema = z.object({
  status: normalizedPrStatusSchema,
  comments: z.string().trim().max(COMMENTS_MAX_LENGTH).optional()
});

export const assignPrReviewerSchema = z.object({
  reviewerId: z.string().uuid()
});

export const updatePrReleaseModeSchema = z.object({
  prIds: z.array(z.string().uuid()).min(1),
  mode: z.nativeEnum(ReleaseLinkMode)
});

export type CreatePrInput = z.infer<typeof createPrSchema>;
export type ListPrsQueryInput = z.infer<typeof listPrsQuerySchema>;
export type PrIdParamsInput = z.infer<typeof prIdParamsSchema>;
export type UpdatePrStatusInput = z.infer<typeof updatePrStatusSchema>;
export type AssignPrReviewerInput = z.infer<typeof assignPrReviewerSchema>;
export type UpdatePrReleaseModeInput = z.infer<typeof updatePrReleaseModeSchema>;
