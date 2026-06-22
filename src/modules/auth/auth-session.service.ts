import { randomUUID } from "node:crypto";

import type { PrismaClient, UserStatus } from "@prisma/client";

import { AUTH_SESSION_REVOKE_REASON, LOGOUT_SCOPE, type LogoutScope } from "../../config/auth.constants";
import { LOG_CONTEXT } from "../../config/log.constants";
import { getAuthTokenExpiryDate, signAuthToken } from "../../lib/jwt";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";

type PrismaClientLike = Pick<PrismaClient, "$executeRaw" | "$queryRaw">;

export interface AuthSessionRecord {
  id: string;
  userId: string;
  tokenId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IssueAuthSessionInput {
  userId: string;
  email: string;
  status: UserStatus;
}

export interface IssueAuthSessionResult {
  token: string;
  session: AuthSessionRecord;
  rotatedSessionCount: number;
}

export interface RevokeAuthSessionInput {
  userId: string;
  sessionTokenId: string;
  scope: LogoutScope;
}

export interface RevokeAuthSessionResult {
  scope: LogoutScope;
  revokedSessionCount: number;
  revokedSessionTokenId: string | null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidUuid = (value: string): boolean => UUID_PATTERN.test(value);

const revokeReasonByScope: Record<LogoutScope, string> = {
  [LOGOUT_SCOPE.CURRENT_SESSION]: AUTH_SESSION_REVOKE_REASON.USER_LOGOUT_CURRENT,
  [LOGOUT_SCOPE.ALL_SESSIONS]: AUTH_SESSION_REVOKE_REASON.USER_LOGOUT_ALL
};

export const issueAuthSession = async (
  input: IssueAuthSessionInput,
  prismaClient: PrismaClientLike = prisma
): Promise<IssueAuthSessionResult> => {
  const now = new Date();
  const sessionId = randomUUID();
  const sessionTokenId = randomUUID();
  const token = signAuthToken({
    sub: input.userId,
    sid: sessionTokenId,
    email: input.email,
    status: input.status
  });

  const tokenExpiresAt = getAuthTokenExpiryDate(token);

  const rotatedSessionCount = Number(
    await prismaClient.$executeRaw`
      UPDATE auth_sessions
      SET revoked_at = ${now}, revoked_reason = ${AUTH_SESSION_REVOKE_REASON.NEW_LOGIN_ROTATION}, updated_at = ${now}
      WHERE user_id = ${input.userId}::uuid
      AND revoked_at IS NULL
      AND expires_at > ${now}
    `
  );

  await prismaClient.$executeRaw`
    INSERT INTO auth_sessions (
      id,
      user_id,
      token_id,
      expires_at,
      created_at,
      updated_at
    )
    VALUES (
      ${sessionId}::uuid,
      ${input.userId}::uuid,
      ${sessionTokenId}::uuid,
      ${tokenExpiresAt},
      ${now},
      ${now}
    )
  `;

  const session: AuthSessionRecord = {
    id: sessionId,
    userId: input.userId,
    tokenId: sessionTokenId,
    expiresAt: tokenExpiresAt,
    revokedAt: null,
    revokedReason: null,
    createdAt: now,
    updatedAt: now
  };

  logger.info("Auth session issued", {
    context: LOG_CONTEXT.AUTH,
    userId: input.userId,
    sessionId,
    sessionTokenId,
    rotatedSessionCount,
    expiresAt: tokenExpiresAt.toISOString()
  });

  return {
    token,
    session,
    rotatedSessionCount
  };
};

export const findActiveSessionByTokenId = async (
  sessionTokenId: string,
  prismaClient: PrismaClientLike = prisma
): Promise<AuthSessionRecord | null> => {
  if (!isValidUuid(sessionTokenId)) {
    return null;
  }

  const now = new Date();
  const sessions = await prismaClient.$queryRaw<AuthSessionRecord[]>`
    SELECT
      id,
      user_id as "userId",
      token_id as "tokenId",
      expires_at as "expiresAt",
      revoked_at as "revokedAt",
      revoked_reason as "revokedReason",
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM auth_sessions
    WHERE token_id = ${sessionTokenId}::uuid
      AND revoked_at IS NULL
      AND expires_at > ${now}
    LIMIT 1
  `;

  return sessions[0] ?? null;
};

export const revokeAuthSessions = async (
  input: RevokeAuthSessionInput,
  prismaClient: PrismaClientLike = prisma
): Promise<RevokeAuthSessionResult> => {
  const now = new Date();

  if (input.scope === LOGOUT_SCOPE.ALL_SESSIONS) {
    const revokedSessionCount = Number(
      await prismaClient.$executeRaw`
        UPDATE auth_sessions
        SET revoked_at = ${now}, revoked_reason = ${revokeReasonByScope[input.scope]}, updated_at = ${now}
        WHERE user_id = ${input.userId}::uuid
          AND revoked_at IS NULL
      `
    );

    return {
      scope: input.scope,
      revokedSessionCount,
      revokedSessionTokenId: null
    };
  }

  if (!isValidUuid(input.sessionTokenId)) {
    return {
      scope: input.scope,
      revokedSessionCount: 0,
      revokedSessionTokenId: input.sessionTokenId
    };
  }

  const revokedSessionCount = Number(
    await prismaClient.$executeRaw`
      UPDATE auth_sessions
      SET revoked_at = ${now}, revoked_reason = ${revokeReasonByScope[input.scope]}, updated_at = ${now}
      WHERE user_id = ${input.userId}::uuid
        AND token_id = ${input.sessionTokenId}::uuid
        AND revoked_at IS NULL
    `
  );

  return {
    scope: input.scope,
    revokedSessionCount,
    revokedSessionTokenId: input.sessionTokenId
  };
};
