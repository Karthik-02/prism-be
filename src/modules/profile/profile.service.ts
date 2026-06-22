import { DomainStatus, UserStatus, type Prisma, type PrismaClient } from "@prisma/client";

import { PERMISSION_KEY } from "../../config/permissions";
import { HTTP_STATUS } from "../../config/http.constants";
import { LOG_CONTEXT } from "../../config/log.constants";
import { AppError } from "../../lib/app-error";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { AUDIT_ACTION, AUDIT_ENTITY } from "../audit/audit.constants";
import { createAuditLog } from "../audit/audit.service";
import { NOTIFICATION_EVENT } from "../notifications/notification.constants";
import { logNotificationOutcomes } from "../notifications/notification.service";
import { listUserIdsByPermission, resolveUserPermissionSet } from "../rbac/rbac.service";
import { PROFILE_ERROR_MESSAGE } from "./profile.constants";
import type { UpdateProfileInput } from "./profile.schema";

type PrismaClientLike = PrismaClient | Prisma.TransactionClient;

interface UserWithRoles {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  githubUserId: string;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  userRoles: Array<{
    role: {
      id: string;
      name: string;
    };
  }>;
}

export interface ProfileView {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  githubUserId: string;
  status: UserStatus;
  roles: Array<{
    id: string;
    name: string;
  }>;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileResult {
  profile: ProfileView;
  requiresVerification: boolean;
  notifiedVerifierCount: number;
}

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const extractDomain = (email: string): string => {
  const [, domain] = email.split("@");

  if (!domain) {
    throw new AppError(PROFILE_ERROR_MESSAGE.EMAIL_DOMAIN_NOT_ALLOWED, HTTP_STATUS.BAD_REQUEST);
  }

  return domain;
};

const ensureAllowedEmailDomain = async (
  email: string,
  prismaClient: PrismaClientLike
): Promise<void> => {
  const domain = extractDomain(email);
  const domainRecord = await prismaClient.emailDomain.findUnique({
    where: {
      domain
    }
  });

  if (!domainRecord || domainRecord.status !== DomainStatus.ACTIVE) {
    throw new AppError(PROFILE_ERROR_MESSAGE.EMAIL_DOMAIN_NOT_ALLOWED, HTTP_STATUS.FORBIDDEN);
  }
};

const findUserWithRolesById = async (
  userId: string,
  prismaClient: PrismaClientLike
): Promise<UserWithRoles | null> =>
  prismaClient.user.findUnique({
    where: {
      id: userId
    },
    include: {
      userRoles: {
        include: {
          role: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    }
  });

const toProfileView = (user: UserWithRoles, permissions: string[]): ProfileView => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  githubUserId: user.githubUserId,
  status: user.status,
  roles: user.userRoles.map((userRole) => ({
    id: userRole.role.id,
    name: userRole.role.name
  })),
  permissions,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString()
});

export class ProfileService {
  async getProfile(userId: string): Promise<ProfileView> {
    const user = await findUserWithRolesById(userId, prisma);

    if (!user) {
      throw new AppError(PROFILE_ERROR_MESSAGE.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    const permissions = await resolveUserPermissionSet(userId, prisma);

    logger.debug("Profile fetched", {
      context: LOG_CONTEXT.PROFILE,
      userId
    });

    return toProfileView(user, [...permissions]);
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<UpdateProfileResult> {
    logger.info("Profile update requested", {
      context: LOG_CONTEXT.PROFILE,
      userId,
      providedFields: Object.keys(input)
    });

    return prisma.$transaction(async (transactionClient) => {
      const currentUser = await findUserWithRolesById(userId, transactionClient);

      if (!currentUser) {
        throw new AppError(PROFILE_ERROR_MESSAGE.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      }

      const updateData: Prisma.UserUpdateInput = {};
      const changedFields: Record<string, { before: string; after: string }> = {};

      if (typeof input.firstName !== "undefined" && input.firstName !== currentUser.firstName) {
        updateData.firstName = input.firstName;
        changedFields.firstName = {
          before: currentUser.firstName,
          after: input.firstName
        };
      }

      if (typeof input.lastName !== "undefined" && input.lastName !== currentUser.lastName) {
        updateData.lastName = input.lastName;
        changedFields.lastName = {
          before: currentUser.lastName,
          after: input.lastName
        };
      }

      let normalizedEmail: string | undefined;
      let emailChanged = false;

      if (typeof input.email !== "undefined") {
        normalizedEmail = normalizeEmail(input.email);
        emailChanged = normalizedEmail !== currentUser.email;

        if (emailChanged) {
          await ensureAllowedEmailDomain(normalizedEmail, transactionClient);

          const existingUser = await transactionClient.user.findUnique({
            where: {
              email: normalizedEmail
            },
            select: {
              id: true
            }
          });

          if (existingUser && existingUser.id !== userId) {
            throw new AppError(PROFILE_ERROR_MESSAGE.EMAIL_ALREADY_IN_USE, HTTP_STATUS.CONFLICT);
          }

          updateData.email = normalizedEmail;
          changedFields.email = {
            before: currentUser.email,
            after: normalizedEmail
          };
        }
      }

      const githubChanged =
        typeof input.githubUserId !== "undefined" && input.githubUserId !== currentUser.githubUserId;

      if (githubChanged && typeof input.githubUserId !== "undefined") {
        updateData.githubUserId = input.githubUserId;
        changedFields.githubUserId = {
          before: currentUser.githubUserId,
          after: input.githubUserId
        };
      }

      const requiresVerification = emailChanged || githubChanged;

      if (requiresVerification && currentUser.status !== UserStatus.PENDING_VERIFICATION) {
        updateData.status = UserStatus.PENDING_VERIFICATION;
        changedFields.status = {
          before: currentUser.status,
          after: UserStatus.PENDING_VERIFICATION
        };
      }

      let updatedUser = currentUser;

      if (Object.keys(updateData).length) {
        await transactionClient.user.update({
          where: {
            id: userId
          },
          data: updateData,
          select: {
            id: true
          }
        });

        const refreshedUser = await findUserWithRolesById(userId, transactionClient);

        if (!refreshedUser) {
          throw new AppError(PROFILE_ERROR_MESSAGE.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
        }

        updatedUser = refreshedUser;
      }

      await createAuditLog(
        {
          entityType: AUDIT_ENTITY.USER,
          entityId: userId,
          action: AUDIT_ACTION.PROFILE_UPDATED,
          performedBy: userId,
          metadata: {
            changedFields,
            requiresVerification
          }
        },
        transactionClient
      );

      let notifiedVerifierCount = 0;

      if (requiresVerification) {
        const verifierIds = await listUserIdsByPermission(
          {
            permission: PERMISSION_KEY.CAN_VERIFY_USERS,
            status: UserStatus.ACTIVE,
            excludeUserId: userId
          },
          transactionClient
        );

        notifiedVerifierCount = await logNotificationOutcomes(
          {
            eventType: NOTIFICATION_EVENT.PROFILE_VERIFICATION_REQUIRED,
            recipientIds: verifierIds
          },
          transactionClient
        );

        await createAuditLog(
          {
            entityType: AUDIT_ENTITY.USER,
            entityId: userId,
            action: AUDIT_ACTION.PROFILE_VERIFICATION_REQUIRED,
            performedBy: userId,
            metadata: {
              notifiedVerifierCount
            }
          },
          transactionClient
        );
      }

      logger.info("Profile update completed", {
        context: LOG_CONTEXT.PROFILE,
        userId,
        requiresVerification,
        notifiedVerifierCount
      });

      const permissions = await resolveUserPermissionSet(userId, transactionClient);

      return {
        profile: toProfileView(updatedUser, [...permissions]),
        requiresVerification,
        notifiedVerifierCount
      };
    });
  }
}
