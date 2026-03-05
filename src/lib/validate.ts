import type { ZodTypeAny } from "zod";

export const parseBody = <T extends ZodTypeAny>(schema: T, body: unknown) => schema.parse(body);
