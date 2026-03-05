import type { PrismaClient, Prisma } from "@prisma/client";

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

  const permissions = new Set<string>();

  for (const userRole of userRoles) {
    for (const rolePermission of userRole.role.rolePermissions) {
      permissions.add(rolePermission.permission.key);
    }
  }

  return permissions;
};
