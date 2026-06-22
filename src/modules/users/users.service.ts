import { DomainStatus, UserStatus, type Prisma, type PrismaClient } from "@prisma/client";

import type { PermissionKey } from "../../config/permissions";
import { HTTP_STATUS } from "../../config/http.constants";
import { LOG_CONTEXT } from "../../config/log.constants";
import { AppError } from "../../lib/app-error";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { AUDIT_ACTION, AUDIT_ENTITY } from "../audit/audit.constants";
import { createAuditLog } from "../audit/audit.service";
import { USERS_ERROR_MESSAGE } from "./users.constants";
import type {
  AssignUserRoleInput,
  CreateUserInput,
  DisapproveUserInput,
  ListUsersQueryInput,
  UserDirectoryQueryInput
} from "./users.schema";

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

export interface UserView {
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
  createdAt: string;
  updatedAt: string;
}

export interface UserDirectoryView {
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
}

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const extractDomain = (email: string): string => {
  const [, domain] = email.split("@");

  if (!domain) {
    throw new AppError(USERS_ERROR_MESSAGE.EMAIL_DOMAIN_NOT_ALLOWED, HTTP_STATUS.BAD_REQUEST);
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
    throw new AppError(USERS_ERROR_MESSAGE.EMAIL_DOMAIN_NOT_ALLOWED, HTTP_STATUS.FORBIDDEN);
  }
};

const findUserById = async (
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

const toUserView = (user: UserWithRoles): UserView => ({
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
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString()
});

const toUserDirectoryView = (user: UserWithRoles): UserDirectoryView => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  githubUserId: user.githubUserId,
  status: user.status,
  roles: user.userRoles.map((userRole) => ({
    id: userRole.role.id,
    name: userRole.role.name
  }))
});

export class UsersService {
  async createUser(input: CreateUserInput, actorUserId: string): Promise<UserView> {
    const email = normalizeEmail(input.email);

    logger.info("User creation requested", {
      context: LOG_CONTEXT.USER,
      actorUserId,
      email
    });

    return prisma.$transaction(async (transactionClient) => {
      await ensureAllowedEmailDomain(email, transactionClient);

      const existingUser = await transactionClient.user.findUnique({
        where: {
          email
        },
        select: {
          id: true
        }
      });

      if (existingUser) {
        throw new AppError(USERS_ERROR_MESSAGE.EMAIL_ALREADY_IN_USE, HTTP_STATUS.CONFLICT);
      }

      const createdUser = await transactionClient.user.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          email,
          githubUserId: input.githubUserId,
          status: input.status
        },
        select: {
          id: true
        }
      });

      await createAuditLog(
        {
          entityType: AUDIT_ENTITY.USER,
          entityId: createdUser.id,
          action: AUDIT_ACTION.USER_CREATED,
          performedBy: actorUserId,
          metadata: {
            status: input.status
          }
        },
        transactionClient
      );

      const user = await findUserById(createdUser.id, transactionClient);

      if (!user) {
        throw new AppError(USERS_ERROR_MESSAGE.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      }

      logger.info("User created", {
        context: LOG_CONTEXT.USER,
        actorUserId,
        userId: user.id,
        status: user.status
      });

      return toUserView(user);
    });
  }

  async listUsers(query: ListUsersQueryInput): Promise<UserView[]> {
    const users = await prisma.user.findMany({
      where: {
        ...(query.status ? { status: query.status } : {})
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
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    logger.debug("Users listed", {
      context: LOG_CONTEXT.USER,
      statusFilter: query.status,
      totalUsers: users.length
    });

    return users.map(toUserView);
  }

  async listUserDirectory(query: UserDirectoryQueryInput): Promise<UserDirectoryView[]> {
    const search = query.search?.trim();
    const permissionKey = query.permissionKey as PermissionKey | undefined;

    const users = await prisma.user.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(permissionKey
          ? {
              userRoles: {
                some: {
                  role: {
                    rolePermissions: {
                      some: {
                        permission: {
                          key: permissionKey
                        }
                      }
                    }
                  }
                }
              }
            }
          : {}),
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { githubUserId: { contains: search, mode: "insensitive" } }
              ]
            }
          : {})
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
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }, { email: "asc" }]
    });

    logger.debug("User directory listed", {
      context: LOG_CONTEXT.USER,
      statusFilter: query.status,
      permissionFilter: permissionKey,
      search,
      totalUsers: users.length
    });

    return users.map(toUserDirectoryView);
  }

  async approveUser(userId: string, actorUserId: string): Promise<UserView> {
    logger.info("User approval requested", {
      context: LOG_CONTEXT.USER,
      actorUserId,
      userId
    });

    return prisma.$transaction(async (transactionClient) => {
      const currentUser = await findUserById(userId, transactionClient);

      if (!currentUser) {
        throw new AppError(USERS_ERROR_MESSAGE.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      }

      await transactionClient.user.update({
        where: {
          id: userId
        },
        data: {
          status: UserStatus.ACTIVE
        }
      });

      await createAuditLog(
        {
          entityType: AUDIT_ENTITY.USER,
          entityId: userId,
          action: AUDIT_ACTION.USER_APPROVED,
          performedBy: actorUserId,
          metadata: {
            previousStatus: currentUser.status,
            nextStatus: UserStatus.ACTIVE
          }
        },
        transactionClient
      );

      const updatedUser = await findUserById(userId, transactionClient);

      if (!updatedUser) {
        throw new AppError(USERS_ERROR_MESSAGE.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      }

      return toUserView(updatedUser);
    });
  }

  async disapproveUser(
    userId: string,
    input: DisapproveUserInput,
    actorUserId: string
  ): Promise<UserView> {
    logger.info("User disapproval requested", {
      context: LOG_CONTEXT.USER,
      actorUserId,
      userId
    });

    return prisma.$transaction(async (transactionClient) => {
      const currentUser = await findUserById(userId, transactionClient);

      if (!currentUser) {
        throw new AppError(USERS_ERROR_MESSAGE.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      }

      await transactionClient.user.update({
        where: {
          id: userId
        },
        data: {
          status: UserStatus.DISAPPROVED
        }
      });

      await createAuditLog(
        {
          entityType: AUDIT_ENTITY.USER,
          entityId: userId,
          action: AUDIT_ACTION.USER_DISAPPROVED,
          performedBy: actorUserId,
          metadata: {
            previousStatus: currentUser.status,
            nextStatus: UserStatus.DISAPPROVED,
            reason: input.reason ?? null
          }
        },
        transactionClient
      );

      const updatedUser = await findUserById(userId, transactionClient);

      if (!updatedUser) {
        throw new AppError(USERS_ERROR_MESSAGE.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      }

      return toUserView(updatedUser);
    });
  }

  async assignRoleToUser(
    userId: string,
    input: AssignUserRoleInput,
    actorUserId: string
  ): Promise<UserView> {
    logger.info("User role assignment requested", {
      context: LOG_CONTEXT.USER,
      actorUserId,
      userId,
      roleId: input.roleId
    });

    return prisma.$transaction(async (transactionClient) => {
      const user = await transactionClient.user.findUnique({
        where: {
          id: userId
        },
        select: {
          id: true
        }
      });

      if (!user) {
        throw new AppError(USERS_ERROR_MESSAGE.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      }

      const role = await transactionClient.role.findUnique({
        where: {
          id: input.roleId
        },
        select: {
          id: true
        }
      });

      if (!role) {
        throw new AppError(USERS_ERROR_MESSAGE.ROLE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      }

      const existingAssignment = await transactionClient.userRole.findUnique({
        where: {
          userId_roleId: {
            userId,
            roleId: input.roleId
          }
        },
        select: {
          userId: true
        }
      });

      if (existingAssignment) {
        throw new AppError(USERS_ERROR_MESSAGE.USER_ROLE_ALREADY_ASSIGNED, HTTP_STATUS.CONFLICT);
      }

      await transactionClient.userRole.create({
        data: {
          userId,
          roleId: input.roleId
        }
      });

      await createAuditLog(
        {
          entityType: AUDIT_ENTITY.USER_ROLE,
          entityId: userId,
          action: AUDIT_ACTION.USER_ROLE_ASSIGNED,
          performedBy: actorUserId,
          metadata: {
            roleId: input.roleId
          }
        },
        transactionClient
      );

      const updatedUser = await findUserById(userId, transactionClient);

      if (!updatedUser) {
        throw new AppError(USERS_ERROR_MESSAGE.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      }

      return toUserView(updatedUser);
    });
  }

  async removeRoleFromUser(userId: string, roleId: string, actorUserId: string): Promise<UserView> {
    logger.info("User role removal requested", {
      context: LOG_CONTEXT.USER,
      actorUserId,
      userId,
      roleId
    });

    return prisma.$transaction(async (transactionClient) => {
      const user = await transactionClient.user.findUnique({
        where: {
          id: userId
        },
        select: {
          id: true
        }
      });

      if (!user) {
        throw new AppError(USERS_ERROR_MESSAGE.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      }

      const role = await transactionClient.role.findUnique({
        where: {
          id: roleId
        },
        select: {
          id: true
        }
      });

      if (!role) {
        throw new AppError(USERS_ERROR_MESSAGE.ROLE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      }

      const existingAssignment = await transactionClient.userRole.findUnique({
        where: {
          userId_roleId: {
            userId,
            roleId
          }
        },
        select: {
          userId: true
        }
      });

      if (!existingAssignment) {
        throw new AppError(USERS_ERROR_MESSAGE.USER_ROLE_NOT_ASSIGNED, HTTP_STATUS.NOT_FOUND);
      }

      await transactionClient.userRole.delete({
        where: {
          userId_roleId: {
            userId,
            roleId
          }
        }
      });

      await createAuditLog(
        {
          entityType: AUDIT_ENTITY.USER_ROLE,
          entityId: userId,
          action: AUDIT_ACTION.USER_ROLE_REMOVED,
          performedBy: actorUserId,
          metadata: {
            roleId
          }
        },
        transactionClient
      );

      const updatedUser = await findUserById(userId, transactionClient);

      if (!updatedUser) {
        throw new AppError(USERS_ERROR_MESSAGE.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      }

      return toUserView(updatedUser);
    });
  }
}
