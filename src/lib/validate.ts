import type { ZodTypeAny } from "zod";

export const parseBody = <T extends ZodTypeAny>(schema: T, body: unknown) => schema.parse(body);
export const parseQuery = <T extends ZodTypeAny>(schema: T, query: unknown) => schema.parse(query);
export const parseParams = <T extends ZodTypeAny>(schema: T, params: unknown) => schema.parse(params);
