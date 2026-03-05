import { UserStatus, DomainStatus, PrismaClient } from "@prisma/client";

import { env } from "../src/config/env";
import { PERMISSIONS } from "../src/config/permissions";
import { ROLE_NAME } from "../src/config/role.constants";

const prisma = new PrismaClient();

const ensurePermissions = async (): Promise<void> => {
  for (const permissionKey of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permissionKey },
      update: {},
      create: {
        key: permissionKey,
        description: permissionKey
      }
    });
  }
};

const ensureSuperAdmin = async (): Promise<void> => {
  const adminEmail = env.SEED_SUPER_ADMIN_EMAIL;

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      firstName: env.SEED_SUPER_ADMIN_FIRST_NAME,
      lastName: env.SEED_SUPER_ADMIN_LAST_NAME,
      githubUserId: env.SEED_SUPER_ADMIN_GITHUB_USER_ID,
      status: UserStatus.ACTIVE
    },
    create: {
      email: adminEmail,
      firstName: env.SEED_SUPER_ADMIN_FIRST_NAME,
      lastName: env.SEED_SUPER_ADMIN_LAST_NAME,
      githubUserId: env.SEED_SUPER_ADMIN_GITHUB_USER_ID,
      status: UserStatus.ACTIVE
    }
  });

  if (env.SEED_AUTO_ALLOW_ADMIN_DOMAIN) {
    const domain = adminEmail.split("@")[1];

    await prisma.emailDomain.upsert({
      where: { domain },
      update: {
        status: DomainStatus.ACTIVE
      },
      create: {
        domain,
        status: DomainStatus.ACTIVE,
        createdBy: adminUser.id
      }
    });
  }

  const superAdminRole = await prisma.role.upsert({
    where: { name: ROLE_NAME.SUPER_ADMIN },
    update: {
      description: "System bootstrap role with all permissions"
    },
    create: {
      name: ROLE_NAME.SUPER_ADMIN,
      description: "System bootstrap role with all permissions",
      createdBy: adminUser.id
    }
  });

  const permissionRows = await prisma.permission.findMany({
    where: {
      key: {
        in: [...PERMISSIONS]
      }
    },
    select: {
      id: true
    }
  });

  await prisma.rolePermission.createMany({
    data: permissionRows.map((permission) => ({
      roleId: superAdminRole.id,
      permissionId: permission.id
    })),
    skipDuplicates: true
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: superAdminRole.id
      }
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: superAdminRole.id
    }
  });
};

const ensureSystemActor = async (): Promise<void> => {
  await prisma.user.upsert({
    where: { email: env.SYSTEM_ACTOR_EMAIL },
    update: {
      firstName: env.SYSTEM_ACTOR_FIRST_NAME,
      lastName: env.SYSTEM_ACTOR_LAST_NAME,
      githubUserId: env.SYSTEM_ACTOR_GITHUB_USER_ID,
      status: UserStatus.ACTIVE
    },
    create: {
      email: env.SYSTEM_ACTOR_EMAIL,
      firstName: env.SYSTEM_ACTOR_FIRST_NAME,
      lastName: env.SYSTEM_ACTOR_LAST_NAME,
      githubUserId: env.SYSTEM_ACTOR_GITHUB_USER_ID,
      status: UserStatus.ACTIVE
    }
  });
};

const run = async (): Promise<void> => {
  await ensureSystemActor();
  await ensurePermissions();
  await ensureSuperAdmin();
};

run()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
