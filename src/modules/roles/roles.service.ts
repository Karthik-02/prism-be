import type { Permission, Prisma, PrismaClient } from "@prisma/client";

import { HTTP_STATUS } from "../../config/http.constants";
import { LOG_CONTEXT } from "../../config/log.constants";
import { AppError } from "../../lib/app-error";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { AUDIT_ACTION, AUDIT_ENTITY } from "../audit/audit.constants";
import { createAuditLog } from "../audit/audit.service";
import { ROLES_ERROR_MESSAGE } from "./roles.constants";
import type {
  AssignRolePermissionInput,
  CreateRoleInput,
  RolePermissionReferenceInput,
  UpdateRoleInput
} from "./roles.schema";

type PrismaClientLike = PrismaClient | Prisma.TransactionClient;

interface RoleWithPermissions {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: Date;
  rolePermissions: Array<{
    permission: {
      id: string;
      key: string;
      description: string | null;
    };
  }>;
}

export interface RoleView {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: string;
  permissions: Array<{
    id: string;
    key: string;
    description: string | null;
  }>;
}

const findRoleWithPermissions = async (
  roleId: string,
  prismaClient: PrismaClientLike
): Promise<RoleWithPermissions | null> =>
  prismaClient.role.findUnique({
    where: {
      id: roleId
    },
    include: {
      rolePermissions: {
        include: {
          permission: {
            select: {
              id: true,
              key: true,
              description: true
            }
          }
        }
      }
    }
  });

const toRoleView = (role: RoleWithPermissions): RoleView => ({
  id: role.id,
  name: role.name,
  description: role.description,
  createdBy: role.createdBy,
  createdAt: role.createdAt.toISOString(),
  permissions: role.rolePermissions.map((rolePermission) => ({
    id: rolePermission.permission.id,
    key: rolePermission.permission.key,
    description: rolePermission.permission.description
  }))
});

const ensureUniqueRoleName = async (
  roleName: string,
  prismaClient: PrismaClientLike,
  excludeRoleId?: string
): Promise<void> => {
  const existingRole = await prismaClient.role.findFirst({
    where: {
      name: roleName,
      ...(excludeRoleId ? { id: { not: excludeRoleId } } : {})
    },
    select: {
      id: true
    }
  });

  if (existingRole) {
    throw new AppError(ROLES_ERROR_MESSAGE.ROLE_NAME_ALREADY_EXISTS, HTTP_STATUS.CONFLICT);
  }
};

const resolvePermission = async (
  input: RolePermissionReferenceInput,
  prismaClient: PrismaClientLike
): Promise<Permission> => {
  if (input.permissionId) {
    const permissionById = await prismaClient.permission.findUnique({
      where: {
        id: input.permissionId
      }
    });

    if (!permissionById) {
      throw new AppError(ROLES_ERROR_MESSAGE.PERMISSION_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    return permissionById;
  }

  if (input.permissionKey) {
    const permissionByKey = await prismaClient.permission.findUnique({
      where: {
        key: input.permissionKey
      }
    });

    if (!permissionByKey) {
      throw new AppError(ROLES_ERROR_MESSAGE.PERMISSION_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    return permissionByKey;
  }

  throw new AppError(ROLES_ERROR_MESSAGE.PERMISSION_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
};

const resolvePermissions = async (
  inputs: RolePermissionReferenceInput[],
  prismaClient: PrismaClientLike
): Promise<Permission[]> => {
  const permissionById = new Map<string, Permission>();

  for (const input of inputs) {
    const permission = await resolvePermission(input, prismaClient);
    permissionById.set(permission.id, permission);
  }

  return [...permissionById.values()];
};

export class RolesService {
  async createRole(input: CreateRoleInput, actorUserId: string): Promise<RoleView> {
    logger.info("Role creation requested", {
      context: LOG_CONTEXT.ROLE,
      actorUserId,
      roleName: input.name,
      requestedPermissionCount: input.permissions?.length ?? 0
    });

    return prisma.$transaction(async (transactionClient) => {
      await ensureUniqueRoleName(input.name, transactionClient);

      const createdRole = await transactionClient.role.create({
        data: {
          name: input.name,
          description: input.description,
          createdBy: actorUserId
        }
      });

      const resolvedPermissions = input.permissions
        ? await resolvePermissions(input.permissions, transactionClient)
        : [];

      if (resolvedPermissions.length) {
        await transactionClient.rolePermission.createMany({
          data: resolvedPermissions.map((permission) => ({
            roleId: createdRole.id,
            permissionId: permission.id
          }))
        });

        for (const permission of resolvedPermissions) {
          await createAuditLog(
            {
              entityType: AUDIT_ENTITY.ROLE_PERMISSION,
              entityId: createdRole.id,
              action: AUDIT_ACTION.ROLE_PERMISSION_ASSIGNED,
              performedBy: actorUserId,
              metadata: {
                permissionId: permission.id,
                permissionKey: permission.key
              }
            },
            transactionClient
          );
        }
      }

      await createAuditLog(
        {
          entityType: AUDIT_ENTITY.ROLE,
          entityId: createdRole.id,
          action: AUDIT_ACTION.ROLE_CREATED,
          performedBy: actorUserId,
          metadata: {
            name: createdRole.name,
            permissionCount: resolvedPermissions.length
          }
        },
        transactionClient
      );

      const role = await findRoleWithPermissions(createdRole.id, transactionClient);

      if (!role) {
        throw new AppError(ROLES_ERROR_MESSAGE.ROLE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      }

      return toRoleView(role);
    });
  }

  async listRoles(): Promise<RoleView[]> {
    const roles = await prisma.role.findMany({
      include: {
        rolePermissions: {
          include: {
            permission: {
              select: {
                id: true,
                key: true,
                description: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    logger.debug("Roles listed", {
      context: LOG_CONTEXT.ROLE,
      totalRoles: roles.length
    });

    return roles.map(toRoleView);
  }

  async updateRole(roleId: string, input: UpdateRoleInput, actorUserId: string): Promise<RoleView> {
    logger.info("Role update requested", {
      context: LOG_CONTEXT.ROLE,
      actorUserId,
      roleId,
      requestedPermissionCount: input.permissions?.length
    });

    return prisma.$transaction(async (transactionClient) => {
      const currentRole = await transactionClient.role.findUnique({
        where: {
          id: roleId
        }
      });

      if (!currentRole) {
        throw new AppError(ROLES_ERROR_MESSAGE.ROLE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      }

      const updateData: Prisma.RoleUpdateInput = {};
      const changedFields: Record<string, { before: string | null; after: string | null }> = {};

      if (typeof input.name !== "undefined" && input.name !== currentRole.name) {
        await ensureUniqueRoleName(input.name, transactionClient, roleId);
        updateData.name = input.name;
        changedFields.name = {
          before: currentRole.name,
          after: input.name
        };
      }

      if (typeof input.description !== "undefined" && input.description !== currentRole.description) {
        updateData.description = input.description;
        changedFields.description = {
          before: currentRole.description,
          after: input.description
        };
      }

      if (Object.keys(updateData).length) {
        await transactionClient.role.update({
          where: {
            id: roleId
          },
          data: updateData
        });
      }

      let assignedPermissionCount = 0;
      let removedPermissionCount = 0;

      if (typeof input.permissions !== "undefined") {
        const desiredPermissions = await resolvePermissions(input.permissions, transactionClient);
        const desiredPermissionById = new Map(desiredPermissions.map((permission) => [permission.id, permission]));

        const existingRolePermissions = await transactionClient.rolePermission.findMany({
          where: {
            roleId
          },
          include: {
            permission: {
              select: {
                id: true,
                key: true
              }
            }
          }
        });

        const existingPermissionById = new Map(
          existingRolePermissions.map(
            (rolePermission: { permission: { id: string; key: string } }): [string, string] => [
              rolePermission.permission.id,
              rolePermission.permission.key
            ]
          )
        );

        const permissionsToAssign = desiredPermissions.filter(
          (permission) => !existingPermissionById.has(permission.id)
        );

        const permissionIdsToRemove = ([...existingPermissionById.keys()] as string[]).filter(
          (permissionId: string) => !desiredPermissionById.has(permissionId)
        );

        if (permissionsToAssign.length) {
          await transactionClient.rolePermission.createMany({
            data: permissionsToAssign.map((permission) => ({
              roleId,
              permissionId: permission.id
            }))
          });
        }

        if (permissionIdsToRemove.length) {
          await transactionClient.rolePermission.deleteMany({
            where: {
              roleId,
              permissionId: {
                in: permissionIdsToRemove
              }
            }
          });
        }

        for (const permission of permissionsToAssign) {
          await createAuditLog(
            {
              entityType: AUDIT_ENTITY.ROLE_PERMISSION,
              entityId: roleId,
              action: AUDIT_ACTION.ROLE_PERMISSION_ASSIGNED,
              performedBy: actorUserId,
              metadata: {
                permissionId: permission.id,
                permissionKey: permission.key
              }
            },
            transactionClient
          );
        }

        for (const permissionId of permissionIdsToRemove) {
          const permissionKey = existingPermissionById.get(permissionId);

          await createAuditLog(
            {
              entityType: AUDIT_ENTITY.ROLE_PERMISSION,
              entityId: roleId,
              action: AUDIT_ACTION.ROLE_PERMISSION_REMOVED,
              performedBy: actorUserId,
              metadata: {
                permissionId,
                permissionKey
              }
            },
            transactionClient
          );
        }

        assignedPermissionCount = permissionsToAssign.length;
        removedPermissionCount = permissionIdsToRemove.length;
      }

      await createAuditLog(
        {
          entityType: AUDIT_ENTITY.ROLE,
          entityId: roleId,
          action: AUDIT_ACTION.ROLE_UPDATED,
          performedBy: actorUserId,
          metadata: {
            changedFields,
            assignedPermissionCount,
            removedPermissionCount
          }
        },
        transactionClient
      );

      const updatedRole = await findRoleWithPermissions(roleId, transactionClient);

      if (!updatedRole) {
        throw new AppError(ROLES_ERROR_MESSAGE.ROLE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      }

      return toRoleView(updatedRole);
    });
  }

  async deleteRole(roleId: string, actorUserId: string): Promise<void> {
    logger.info("Role deletion requested", {
      context: LOG_CONTEXT.ROLE,
      actorUserId,
      roleId
    });

    await prisma.$transaction(async (transactionClient) => {
      const role = await transactionClient.role.findUnique({
        where: {
          id: roleId
        }
      });

      if (!role) {
        throw new AppError(ROLES_ERROR_MESSAGE.ROLE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      }

      await transactionClient.role.delete({
        where: {
          id: roleId
        }
      });

      await createAuditLog(
        {
          entityType: AUDIT_ENTITY.ROLE,
          entityId: roleId,
          action: AUDIT_ACTION.ROLE_DELETED,
          performedBy: actorUserId,
          metadata: {
            name: role.name
          }
        },
        transactionClient
      );
    });
  }

  async assignPermissionToRole(
    roleId: string,
    input: AssignRolePermissionInput,
    actorUserId: string
  ): Promise<RoleView> {
    logger.info("Role permission assignment requested", {
      context: LOG_CONTEXT.ROLE,
      actorUserId,
      roleId,
      permissionId: input.permissionId,
      permissionKey: input.permissionKey
    });

    return prisma.$transaction(async (transactionClient) => {
      const role = await transactionClient.role.findUnique({
        where: {
          id: roleId
        },
        select: {
          id: true
        }
      });

      if (!role) {
        throw new AppError(ROLES_ERROR_MESSAGE.ROLE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      }

      const permission = await resolvePermission(input, transactionClient);

      const existingRolePermission = await transactionClient.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId: permission.id
          }
        },
        select: {
          roleId: true
        }
      });

      if (existingRolePermission) {
        throw new AppError(ROLES_ERROR_MESSAGE.ROLE_PERMISSION_ALREADY_EXISTS, HTTP_STATUS.CONFLICT);
      }

      await transactionClient.rolePermission.create({
        data: {
          roleId,
          permissionId: permission.id
        }
      });

      await createAuditLog(
        {
          entityType: AUDIT_ENTITY.ROLE_PERMISSION,
          entityId: roleId,
          action: AUDIT_ACTION.ROLE_PERMISSION_ASSIGNED,
          performedBy: actorUserId,
          metadata: {
            permissionId: permission.id,
            permissionKey: permission.key
          }
        },
        transactionClient
      );

      const updatedRole = await findRoleWithPermissions(roleId, transactionClient);

      if (!updatedRole) {
        throw new AppError(ROLES_ERROR_MESSAGE.ROLE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      }

      return toRoleView(updatedRole);
    });
  }

  async removePermissionFromRole(
    roleId: string,
    permissionId: string,
    actorUserId: string
  ): Promise<RoleView> {
    logger.info("Role permission removal requested", {
      context: LOG_CONTEXT.ROLE,
      actorUserId,
      roleId,
      permissionId
    });

    return prisma.$transaction(async (transactionClient) => {
      const role = await transactionClient.role.findUnique({
        where: {
          id: roleId
        },
        select: {
          id: true
        }
      });

      if (!role) {
        throw new AppError(ROLES_ERROR_MESSAGE.ROLE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      }

      const permission = await transactionClient.permission.findUnique({
        where: {
          id: permissionId
        },
        select: {
          id: true,
          key: true
        }
      });

      if (!permission) {
        throw new AppError(ROLES_ERROR_MESSAGE.PERMISSION_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      }

      const existingRolePermission = await transactionClient.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId
          }
        },
        select: {
          roleId: true
        }
      });

      if (!existingRolePermission) {
        throw new AppError(ROLES_ERROR_MESSAGE.ROLE_PERMISSION_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      }

      await transactionClient.rolePermission.delete({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId
          }
        }
      });

      await createAuditLog(
        {
          entityType: AUDIT_ENTITY.ROLE_PERMISSION,
          entityId: roleId,
          action: AUDIT_ACTION.ROLE_PERMISSION_REMOVED,
          performedBy: actorUserId,
          metadata: {
            permissionId,
            permissionKey: permission.key
          }
        },
        transactionClient
      );

      const updatedRole = await findRoleWithPermissions(roleId, transactionClient);

      if (!updatedRole) {
        throw new AppError(ROLES_ERROR_MESSAGE.ROLE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      }

      return toRoleView(updatedRole);
    });
  }
}
