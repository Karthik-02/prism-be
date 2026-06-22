import { ReleaseNoteScope } from "@prisma/client";
import { z } from "zod";

const releaseIdParamSchema = z.object({
  releaseId: z.string().uuid()
});

const releaseIdQuerySchema = z.object({
  releaseId: z.string().uuid()
});

export const releaseNotesOtherSchema = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1)
});

export const generateReleaseNotesSchema = z.object({
  releaseId: z.string().uuid(),
  scope: z.nativeEnum(ReleaseNoteScope).optional(),
  other: z.array(releaseNotesOtherSchema).optional()
});

export const updateReleaseNotesSchema = z.object({
  content: z.string().trim().min(1),
  other: z.array(releaseNotesOtherSchema).optional(),
  expectedVersion: z.number().int().positive()
});

export const releaseNoteParamsSchema = releaseIdParamSchema;
export const releaseNoteQuerySchema = releaseIdQuerySchema;

export type ReleaseNoteParamsInput = z.infer<typeof releaseNoteParamsSchema>;
export type ReleaseNoteQueryInput = z.infer<typeof releaseNoteQuerySchema>;
export type GenerateReleaseNotesInput = z.infer<typeof generateReleaseNotesSchema>;
export type UpdateReleaseNotesInput = z.infer<typeof updateReleaseNotesSchema>;
