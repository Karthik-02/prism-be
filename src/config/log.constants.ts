export const LOG_LEVEL = {
  ERROR: "error",
  WARN: "warn",
  INFO: "info",
  HTTP: "http",
  DEBUG: "debug"
} as const;

export const LOG_LEVELS_PRIORITY = {
  [LOG_LEVEL.ERROR]: 0,
  [LOG_LEVEL.WARN]: 1,
  [LOG_LEVEL.INFO]: 2,
  [LOG_LEVEL.HTTP]: 3,
  [LOG_LEVEL.DEBUG]: 4
} as const;

export const LOG_LEVEL_COLORS = {
  [LOG_LEVEL.ERROR]: "red",
  [LOG_LEVEL.WARN]: "yellow",
  [LOG_LEVEL.INFO]: "green",
  [LOG_LEVEL.HTTP]: "cyan",
  [LOG_LEVEL.DEBUG]: "magenta"
} as const;

export const LOG_CONTEXT = {
  APP: "app",
  AUDIT: "audit",
  AUTH: "auth",
  EMAIL: "email",
  EMAIL_DOMAIN: "email-domain",
  NOTIFICATION: "notification",
  PR: "pr",
  PROFILE: "profile",
  RELEASE: "release",
  RELEASE_NOTE: "release-note",
  ROLE: "role",
  REQUEST: "request",
  RBAC: "rbac",
  PRISMA: "prisma",
  SERVER: "server",
  USER: "user",
  ERROR_HANDLER: "error-handler"
} as const;
