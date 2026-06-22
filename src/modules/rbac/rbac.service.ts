import { UserStatus, type PrismaClient, type Prisma } from "@prisma/client";

import { PERMISSIONS, type PermissionKey } from "../../config/permissions";
import { ROLE_NAME } from "../../config/role.constants";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export const resolveUserPermissionSet = async (
  userId: string,
  prismaClient: PrismaLike = prisma
): Promise<Set<string>> => {
  const userRoles = await prismaClient.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true
            }
          }
        }
      }
    }
  });

  const isSuperAdmin = userRoles.some(
    (userRole: (typeof userRoles)[number]) => userRole.role.name === ROLE_NAME.SUPER_ADMIN
  );
  if (isSuperAdmin) {
    return new Set(PERMISSIONS);
  }

  const user = await prismaClient.user.findUnique({
    where: { id: userId },
    select: { email: true }
  });

  if (user?.email?.toLowerCase() === env.SEED_SUPER_ADMIN_EMAIL.toLowerCase()) {
    return new Set(PERMISSIONS);
  }

  const permissions = new Set<string>();

  for (const userRole of userRoles) {
    for (const rolePermission of userRole.role.rolePermissions) {
      permissions.add(rolePermission.permission.key);
    }
  }

  return permissions;
};

export interface ListUserIdsByPermissionInput {
  permission: PermissionKey;
  status?: UserStatus;
  excludeUserId?: string;
}

export const listUserIdsByPermission = async (
  input: ListUserIdsByPermissionInput,
  prismaClient: PrismaLike = prisma
): Promise<string[]> => {
  const users = await prismaClient.user.findMany({
    where: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.excludeUserId ? { id: { not: input.excludeUserId } } : {}),
      userRoles: {
        some: {
          role: {
            rolePermissions: {
              some: {
                permission: {
                  key: input.permission
                }
              }
            }
          }
        }
      }
    },
    select: {
      id: true
    }
  });

  return users.map((user: { id: string }): string => user.id);
};
