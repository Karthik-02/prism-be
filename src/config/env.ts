import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["error", "warn", "info", "http", "debug"]).default("debug"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 chars"),
  JWT_EXPIRES_IN: z.string().default("30d"),
  JWT_COOKIE_NAME: z.string().default("prism_session"),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SMTP_HOST: z.string().min(1, "SMTP_HOST is required"),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SMTP_USER: z.string().email("SMTP_USER must be a valid email"),
  SMTP_PASS: z.string().min(1, "SMTP_PASS is required"),
  SMTP_FROM_NAME: z.string().default("PRism Team"),
  SMTP_FROM_EMAIL: z.string().email("SMTP_FROM_EMAIL must be a valid email"),
  CORS_ORIGIN: z.string().default("http://localhost:3001"),
  OTP_TTL_MINUTES: z.coerce.number().int().min(1).max(30).default(10),
  OTP_LENGTH: z.coerce.number().int().min(4).max(8).default(6),
  SEED_SUPER_ADMIN_EMAIL: z
    .string()
    .email()
    .default("admin@prism.io")
    .transform((value) => value.toLowerCase()),
  SEED_SUPER_ADMIN_FIRST_NAME: z.string().default("Super"),
  SEED_SUPER_ADMIN_LAST_NAME: z.string().default("Admin"),
  SEED_SUPER_ADMIN_GITHUB_USER_ID: z.string().default("super-admin"),
  SEED_AUTO_ALLOW_ADMIN_DOMAIN: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  SYSTEM_ACTOR_EMAIL: z
    .string()
    .email()
    .default("system@prism.local")
    .transform((value) => value.toLowerCase()),
  SYSTEM_ACTOR_FIRST_NAME: z.string().default("System"),
  SYSTEM_ACTOR_LAST_NAME: z.string().default("Actor"),
  SYSTEM_ACTOR_GITHUB_USER_ID: z.string().default("system")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
