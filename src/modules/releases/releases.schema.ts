import { ReleaseEnvironment, ReleasePrSource, ReleaseStatus } from "@prisma/client";
import { z } from "zod";

const normalizedEnvironmentSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
  z.nativeEnum(ReleaseEnvironment)
);

const normalizedStatusSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
  z.nativeEnum(ReleaseStatus)
);

export const createReleaseSchema = z.object({
  environment: normalizedEnvironmentSchema,
  name: z.string().trim().min(1).max(255),
  releaseDate: z.string().datetime().optional(),
  cutoffAt: z.string().datetime(),
  status: normalizedStatusSchema.optional()
});

export const listReleasesQuerySchema = z.object({
  environment: normalizedEnvironmentSchema.optional(),
  status: normalizedStatusSchema.optional()
});

export const releaseIdParamsSchema = z.object({
  id: z.string().uuid()
});

export const addPrToReleaseSchema = z.object({
  prId: z.string().uuid(),
  source: z.nativeEnum(ReleasePrSource).optional()
});

export const updateReleaseSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  environment: normalizedEnvironmentSchema.optional(),
  status: normalizedStatusSchema.optional(),
  cutoffAt: z.string().datetime().optional()
});

export const updateReleaseDateSchema = z.object({
  releaseDate: z.string().datetime()
});

export type CreateReleaseInput = z.infer<typeof createReleaseSchema>;
export type ListReleasesQueryInput = z.infer<typeof listReleasesQuerySchema>;
export type ReleaseIdParamsInput = z.infer<typeof releaseIdParamsSchema>;
export type AddPrToReleaseInput = z.infer<typeof addPrToReleaseSchema>;
export type UpdateReleaseInput = z.infer<typeof updateReleaseSchema>;
export type UpdateReleaseDateInput = z.infer<typeof updateReleaseDateSchema>;
