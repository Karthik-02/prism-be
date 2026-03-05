import { DomainStatus, UserStatus, type User } from "@prisma/client";

import { AUTH_ERROR_MESSAGE, AUTH_RESPONSE_MESSAGE, SESSION_SCOPE, type SessionScope } from "../../config/auth.constants";
import { env } from "../../config/env";
import { HTTP_STATUS } from "../../config/http.constants";
import { LOG_CONTEXT } from "../../config/log.constants";
import { AppError } from "../../lib/app-error";
import { sendOtpEmail } from "../../lib/email";
import { signAuthToken } from "../../lib/jwt";
import { logger } from "../../lib/logger";
import { maskEmail } from "../../lib/log.utils";
import { generateNumericOtp } from "../../lib/otp";
import { prisma } from "../../lib/prisma";
import { AUDIT_ACTION, AUDIT_ENTITY } from "../audit/audit.constants";
import { createAuditLog } from "../audit/audit.service";
import { resolveUserPermissionSet } from "../rbac/rbac.service";
import type { RequestOtpInput, VerifyOtpInput } from "./auth.schema";

const PROFILE_ONLY_STATUSES = new Set<UserStatus>([
  UserStatus.PENDING_VERIFICATION,
  UserStatus.DISAPPROVED
]);

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const extractDomain = (email: string): string => {
  const [, domain] = email.split("@");

  if (!domain) {
    throw new AppError(AUTH_ERROR_MESSAGE.INVALID_EMAIL, HTTP_STATUS.BAD_REQUEST);
  }

  return domain;
};

const ensureDomainIsAllowed = async (email: string): Promise<void> => {
  const domain = extractDomain(email);
  const domainConfig = await prisma.emailDomain.findUnique({ where: { domain } });

  if (!domainConfig || domainConfig.status !== DomainStatus.ACTIVE) {
    logger.warn("OTP request blocked due to disallowed domain", {
      context: LOG_CONTEXT.AUTH,
      email: maskEmail(email),
      domain
    });

    throw new AppError(AUTH_ERROR_MESSAGE.DOMAIN_NOT_ALLOWED, HTTP_STATUS.FORBIDDEN);
  }
};

interface CreateOrLoadUserResult {
  user: User;
  wasCreated: boolean;
}

const createOrLoadUser = async (input: VerifyOtpInput): Promise<CreateOrLoadUserResult> => {
  const email = normalizeEmail(input.email);
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    return {
      user: existingUser,
      wasCreated: false
    };
  }

  const createdUser = await prisma.user.create({
    data: {
      email,
      firstName: input.firstName ?? "",
      lastName: input.lastName ?? "",
      githubUserId: input.githubUserId ?? "",
      status: UserStatus.PENDING_VERIFICATION
    }
  });

  return {
    user: createdUser,
    wasCreated: true
  };
};

const sessionScopeForStatus = (status: UserStatus): SessionScope =>
  PROFILE_ONLY_STATUSES.has(status) ? SESSION_SCOPE.PROFILE_ONLY : SESSION_SCOPE.FULL_ACCESS;

export class AuthService {
  async requestOtp(input: RequestOtpInput): Promise<{ message: string; devOtp?: string }> {
    const email = normalizeEmail(input.email);

    logger.info("OTP request received", {
      context: LOG_CONTEXT.AUTH,
      email: maskEmail(email)
    });

    await ensureDomainIsAllowed(email);

    const otp = generateNumericOtp(env.OTP_LENGTH);
    const expiresAt = new Date(Date.now() + env.OTP_TTL_MINUTES * 60 * 1000);

    await prisma.otpToken.updateMany({
      where: {
        email,
        used: false
      },
      data: {
        used: true
      }
    });

    const createdToken = await prisma.otpToken.create({
      data: {
        email,
        otp,
        expiresAt,
        used: false
      }
    });

    logger.info("OTP token generated", {
      context: LOG_CONTEXT.AUTH,
      email: maskEmail(email),
      otpTokenId: createdToken.id,
      expiresAt: createdToken.expiresAt.toISOString()
    });

    await createAuditLog({
      entityType: AUDIT_ENTITY.OTP_TOKEN,
      entityId: createdToken.id,
      action: AUDIT_ACTION.AUTH_OTP_REQUESTED,
      metadata: {
        email,
        expiresAt: createdToken.expiresAt.toISOString()
      }
    });

    await sendOtpEmail({
      email,
      otp,
      ttlMinutes: env.OTP_TTL_MINUTES
    });

    logger.info("OTP request completed", {
      context: LOG_CONTEXT.AUTH,
      email: maskEmail(email)
    });

    return {
      message: AUTH_RESPONSE_MESSAGE.OTP_SENT,
      devOtp: env.NODE_ENV === "production" ? undefined : otp
    };
  }

  async verifyOtp(input: VerifyOtpInput): Promise<{
    token: string;
    user: {
      id: string;
      email: string;
      status: UserStatus;
      permissions: string[];
      sessionScope: SessionScope;
    };
  }> {
    const email = normalizeEmail(input.email);

    logger.info("OTP verification attempt", {
      context: LOG_CONTEXT.AUTH,
      email: maskEmail(email)
    });

    const otpToken = await prisma.otpToken.findFirst({
      where: {
        email,
        otp: input.otp,
        used: false
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    if (!otpToken) {
      logger.warn("OTP verification failed: token not found", {
        context: LOG_CONTEXT.AUTH,
        email: maskEmail(email)
      });

      throw new AppError(AUTH_ERROR_MESSAGE.INVALID_OTP, HTTP_STATUS.BAD_REQUEST);
    }

    if (otpToken.expiresAt <= new Date()) {
      await prisma.otpToken.update({
        where: {
          id: otpToken.id
        },
        data: {
          used: true
        }
      });

      await createAuditLog({
        entityType: AUDIT_ENTITY.OTP_TOKEN,
        entityId: otpToken.id,
        action: AUDIT_ACTION.AUTH_OTP_EXPIRED,
        metadata: {
          email
        }
      });

      logger.warn("OTP verification failed: token expired", {
        context: LOG_CONTEXT.AUTH,
        email: maskEmail(email),
        otpTokenId: otpToken.id
      });

      throw new AppError(AUTH_ERROR_MESSAGE.EXPIRED_OTP, HTTP_STATUS.BAD_REQUEST);
    }

    const consumeResult = await prisma.otpToken.updateMany({
      where: {
        id: otpToken.id,
        used: false
      },
      data: {
        used: true
      }
    });

    if (consumeResult.count !== 1) {
      logger.warn("OTP verification failed: token already used", {
        context: LOG_CONTEXT.AUTH,
        email: maskEmail(email),
        otpTokenId: otpToken.id
      });

      throw new AppError(AUTH_ERROR_MESSAGE.USED_OTP, HTTP_STATUS.BAD_REQUEST);
    }

    await createAuditLog({
      entityType: AUDIT_ENTITY.OTP_TOKEN,
      entityId: otpToken.id,
      action: AUDIT_ACTION.AUTH_OTP_CONSUMED,
      metadata: {
        email
      }
    });

    const { user, wasCreated } = await createOrLoadUser({ ...input, email });

    if (wasCreated) {
      logger.info("User created during OTP verification", {
        context: LOG_CONTEXT.AUTH,
        userId: user.id,
        email: maskEmail(user.email),
        status: user.status
      });

      await createAuditLog({
        entityType: AUDIT_ENTITY.USER,
        entityId: user.id,
        action: AUDIT_ACTION.AUTH_USER_CREATED,
        performedBy: user.id,
        metadata: {
          email: user.email
        }
      });
    }

    if (user.status === UserStatus.INACTIVE) {
      logger.warn("Inactive user blocked during OTP verification", {
        context: LOG_CONTEXT.AUTH,
        userId: user.id,
        email: maskEmail(user.email)
      });

      throw new AppError(AUTH_ERROR_MESSAGE.INACTIVE_USER_LOGIN_BLOCKED, HTTP_STATUS.FORBIDDEN);
    }

    const permissions = await resolveUserPermissionSet(user.id);

    const token = signAuthToken({
      sub: user.id,
      email: user.email,
      status: user.status
    });

    await createAuditLog({
      entityType: AUDIT_ENTITY.AUTH_SESSION,
      entityId: user.id,
      action: AUDIT_ACTION.AUTH_LOGIN_SUCCESS,
      performedBy: user.id,
      metadata: {
        status: user.status,
        scope: sessionScopeForStatus(user.status)
      }
    });

    logger.info("OTP verification succeeded", {
      context: LOG_CONTEXT.AUTH,
      userId: user.id,
      email: maskEmail(user.email),
      status: user.status,
      permissionCount: permissions.size
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
        permissions: [...permissions],
        sessionScope: sessionScopeForStatus(user.status)
      }
    };
  }
}
