import {
  PrStatus,
  ReleaseEnvironment,
  ReleaseLinkMode,
  ReleasePrSource,
  ReleaseStatus,
  ReleasePrMap,
  UserStatus,
  type Prisma,
  type PrismaClient
} from "@prisma/client";

import { EMAIL_CONFIG } from "../../config/email.constants";
import { PERMISSION_KEY, type PermissionKey } from "../../config/permissions";
import { HTTP_STATUS } from "../../config/http.constants";
import { LOG_CONTEXT } from "../../config/log.constants";
import { AppError } from "../../lib/app-error";
import { sendTemplateEmail } from "../../lib/email";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { AUDIT_ACTION, AUDIT_ENTITY } from "../audit/audit.constants";
import { createAuditLog } from "../audit/audit.service";
import { NOTIFICATION_EVENT } from "../notifications/notification.constants";
import { logNotificationOutcomes } from "../notifications/notification.service";
import { RELEASE_ERROR_MESSAGE } from "./releases.constants";
import type {
  AddPrToReleaseInput,
  CreateReleaseInput,
  ListReleasesQueryInput,
  UpdateReleaseDateInput,
  UpdateReleaseInput
} from "./releases.schema";

type PrismaClientLike = PrismaClient | Prisma.TransactionClient;

interface UserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface AutoLinkedPr {
  prId: string;
  repo: string;
  branch: string;
  owner: UserSummary;
}

interface ReleasePrSummaryRecord {
  id: string;
  repo: string;
  branch: string;
  prLink: string;
  status: PrStatus;
  type: string;
  deployedFlag: boolean;
  releaseMode: ReleaseLinkMode;
  comments: string;
  createdAt: Date;
  updatedAt: Date;
  owner: UserSummary;
  reviewer: UserSummary | null;
}

interface ReleaseDetailRecord extends ReleaseWithCounts {
  releasePrMap: Array<{
    releaseId: string;
    prId: string;
    addedBy: string | null;
    source: ReleasePrSource;
    createdAt: Date;
    pr: ReleasePrSummaryRecord;
  }>;
}

interface ReleaseWithCounts {
  id: string;
  environment: ReleaseEnvironment;
  status: ReleaseStatus;
  name: string;
  releaseDate: Date | null;
  cutoffAt: Date | null;
  createdBy: string;
  createdAt: Date;
  _count: {
    releasePrMap: number;
  };
}

export interface ReleaseView {
  id: string;
  environment: ReleaseEnvironment;
  status: ReleaseStatus;
  name: string;
  releaseDate: string | null;
  cutoffAt: string | null;
  createdBy: string;
  createdAt: string;
  prCount: number;
  autoLinkedCount?: number;
}

export interface ReleasePrSummaryView {
  id: string;
  repo: string;
  branch: string;
  prLink: string;
  status: PrStatus;
  type: string;
  deployedFlag: boolean;
  releaseMode: ReleaseLinkMode;
  comments: string;
  owner: UserSummary;
  reviewer: UserSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface LinkedReleasePrView {
  prId: string;
  source: ReleasePrSource;
  addedBy: string | null;
  linkedAt: string;
  pr: ReleasePrSummaryView;
}

export interface ReleaseDetailView extends ReleaseView {
  linkedPrs: LinkedReleasePrView[];
  eligiblePrs: ReleasePrSummaryView[];
}

const toReleaseView = (release: ReleaseWithCounts, autoLinkedCount?: number): ReleaseView => ({
  id: release.id,
  environment: release.environment,
  status: release.status,
  name: release.name,
  releaseDate: release.releaseDate ? release.releaseDate.toISOString() : null,
  cutoffAt: release.cutoffAt ? release.cutoffAt.toISOString() : null,
  createdBy: release.createdBy,
  createdAt: release.createdAt.toISOString(),
  prCount: release._count.releasePrMap + (autoLinkedCount ?? 0),
  ...(typeof autoLinkedCount === "number" ? { autoLinkedCount } : {})
});

const toReleasePrSummaryView = (pr: ReleasePrSummaryRecord): ReleasePrSummaryView => ({
  id: pr.id,
  repo: pr.repo,
  branch: pr.branch,
  prLink: pr.prLink,
  status: pr.status,
  type: pr.type,
  deployedFlag: pr.deployedFlag,
  releaseMode: pr.releaseMode,
  comments: pr.comments,
  owner: pr.owner,
  reviewer: pr.reviewer,
  createdAt: pr.createdAt.toISOString(),
  updatedAt: pr.updatedAt.toISOString()
});

const toLinkedReleasePrView = (
  mapping: ReleaseDetailRecord["releasePrMap"][number]
): LinkedReleasePrView => ({
  prId: mapping.prId,
  source: mapping.source,
  addedBy: mapping.addedBy,
  linkedAt: mapping.createdAt.toISOString(),
  pr: toReleasePrSummaryView(mapping.pr)
});

const getReleaseMoment = (release: { releaseDate: Date | null; createdAt: Date }): Date =>
  release.releaseDate ?? release.createdAt;

const findReleaseOrThrow = async (
  releaseId: string,
  prismaClient: PrismaClientLike
): Promise<ReleaseWithCounts> => {
  const release = await prismaClient.release.findUnique({
    where: { id: releaseId },
    include: {
      _count: {
        select: {
          releasePrMap: true
        }
      }
    }
  });

  if (!release) {
    throw new AppError(RELEASE_ERROR_MESSAGE.RELEASE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  return release;
};

const findReleaseDetailOrThrow = async (
  releaseId: string,
  prismaClient: PrismaClientLike
): Promise<ReleaseDetailRecord> => {
  const release = await prismaClient.release.findUnique({
    where: { id: releaseId },
    include: {
      _count: {
        select: {
          releasePrMap: true
        }
      },
      releasePrMap: {
        include: {
          pr: {
            include: {
              owner: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true
                }
              },
              reviewer: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      }
    }
  });

  if (!release) {
    throw new AppError(RELEASE_ERROR_MESSAGE.RELEASE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  return release as ReleaseDetailRecord;
};

const ensureCutoffPresent = (release: { cutoffAt: Date | null }): void => {
  if (!release.cutoffAt) {
    throw new AppError(RELEASE_ERROR_MESSAGE.CUTOFF_REQUIRED, HTTP_STATUS.UNPROCESSABLE_ENTITY);
  }
};

const listEligiblePrsForRelease = async (
  release: ReleaseWithCounts,
  prismaClient: PrismaClientLike
): Promise<ReleasePrSummaryView[]> => {
  const commonInclude = {
    owner: {
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true
      }
    },
    reviewer: {
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true
      }
    }
  } as const;

  const filters: Prisma.PrWhereInput[] = [
    {
      releasePrMap: {
        none: {
          releaseId: release.id
        }
      }
    }
  ];

  if (release.environment === ReleaseEnvironment.STAGING) {
    filters.push({
      status: {
        in: [PrStatus.APPROVED, PrStatus.DEPLOYED]
      }
    });
  } else if (release.environment === ReleaseEnvironment.PRODUCTION) {
    filters.push({ deployedFlag: true });
    filters.push({
      releasePrMap: {
        some: {
          release: {
            environment: ReleaseEnvironment.STAGING
          }
        }
      }
    });
  }

  const whereClause: Prisma.PrWhereInput = { AND: filters };

  const prs = await prismaClient.pr.findMany({
    where: whereClause,
    include: commonInclude,
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
  });

  return prs.map((pr: (typeof prs)[number]) => toReleasePrSummaryView(pr as ReleasePrSummaryRecord));
};

const ensureCutoffNotPassed = (release: { cutoffAt: Date | null }): void => {
  if (release.cutoffAt && release.cutoffAt.getTime() < Date.now()) {
    throw new AppError(RELEASE_ERROR_MESSAGE.CUTOFF_EXCEEDED, HTTP_STATUS.UNPROCESSABLE_ENTITY);
  }
};

const findActiveUsersWithPermission = async (
  permission: PermissionKey,
  prismaClient: PrismaClientLike
): Promise<UserSummary[]> =>
  prismaClient.user.findMany({
    where: {
      status: UserStatus.ACTIVE,
      userRoles: {
        some: {
          role: {
            rolePermissions: {
              some: {
                permission: {
                  key: permission
                }
              }
            }
          }
        }
      }
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true
    }
  });

const dedupeUsers = (users: UserSummary[]): UserSummary[] => {
  const map = new Map<string, UserSummary>();
  for (const user of users) {
    map.set(user.id, user);
  }
  return [...map.values()];
};

const sendReleaseCreatedEmail = async (
  release: ReleaseView,
  recipients: UserSummary[],
  autoLinkedCount: number
): Promise<void> => {
  if (!recipients.length) {
    return;
  }

  await sendTemplateEmail({
    to: recipients.map((user) => user.email),
    subject: EMAIL_CONFIG.RELEASE_CREATED_SUBJECT,
    headline: `New ${release.environment} release created: ${release.name}`,
    introLines: [
      `A new ${release.environment.toLowerCase()} release has been created.`,
      `Cutoff: ${release.cutoffAt ?? "not set"}. Release date: ${release.releaseDate ?? "TBD"}.`
    ],
    detailRows: [
      { label: "Environment", value: release.environment },
      { label: "Release ID", value: release.id },
      { label: "Cutoff", value: release.cutoffAt ?? "Not set" },
      { label: "Release Date", value: release.releaseDate ?? "Not set" },
      { label: "Auto-linked PRs", value: String(autoLinkedCount) }
    ],
    footerLines: ["This notification was sent to leads and developers."]
  });
};

const sendPrAutoLinkedEmails = async (
  release: ReleaseView,
  prs: Array<{ prId: string; owner: UserSummary; repo: string; branch: string }>
): Promise<void> => {
  if (!prs.length) {
    return;
  }

  const groupedByOwner = prs.reduce<Record<string, Array<{ prId: string; repo: string; branch: string }>>>(
    (acc, pr: AutoLinkedPr) => {
      acc[pr.owner.id] = acc[pr.owner.id] || [];
      acc[pr.owner.id].push({ prId: pr.prId, repo: pr.repo, branch: pr.branch });
      return acc;
    },
    {}
  );

  await Promise.all(
    Object.entries(groupedByOwner).map(async ([ownerId, ownerPrs]) => {
      const owner = prs.find((entry) => entry.owner.id === ownerId)?.owner;
      if (!owner) return;

      await sendTemplateEmail({
        to: [owner.email],
        subject: EMAIL_CONFIG.RELEASE_PR_LINKED_SUBJECT,
        headline: `Your PRs were linked to ${release.environment} release ${release.name}`,
        introLines: [
          "The following PRs were automatically linked:",
          ...ownerPrs.map((pr) => `${pr.repo}/${pr.branch} (${pr.prId})`)
        ],
        detailRows: [
          { label: "Release", value: release.name },
          { label: "Environment", value: release.environment },
          { label: "Release ID", value: release.id }
        ],
        footerLines: ["This is an automated message from PRism."]
      });
    })
  );
};

const findLatestProductionRelease = async (
  prismaClient: PrismaClientLike
): Promise<ReleaseWithCounts | null> =>
  prismaClient.release.findFirst({
    where: { environment: ReleaseEnvironment.PRODUCTION },
    orderBy: [
      { releaseDate: "desc" },
      { createdAt: "desc" }
    ],
    include: {
      _count: {
        select: { releasePrMap: true }
      }
    }
  });

const findAutoLinkCandidatesForStaging = async (prismaClient: PrismaClientLike): Promise<AutoLinkedPr[]> =>
  (
    await prismaClient.pr.findMany({
      where: {
        status: PrStatus.APPROVED,
        releaseMode: ReleaseLinkMode.AUTO,
        releasePrMap: {
          none: {
            release: {
              environment: {
                in: [ReleaseEnvironment.STAGING, ReleaseEnvironment.PRODUCTION]
              }
            }
          }
        }
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    })
  ).map(
    (pr: { id: string; repo: string; branch: string; owner: UserSummary }): AutoLinkedPr => ({
      prId: pr.id,
      repo: pr.repo,
      branch: pr.branch,
      owner: pr.owner
    })
  );

const findAutoLinkCandidatesForProduction = async (
  afterDate: Date,
  prismaClient: PrismaClientLike
) => {
    const stagingReleases = await prismaClient.release.findMany({
    where: {
      environment: ReleaseEnvironment.STAGING,
      OR: [
        { releaseDate: { gt: afterDate } },
        { releaseDate: null, createdAt: { gt: afterDate } }
      ]
    },
    include: {
      releasePrMap: {
        include: {
          pr: {
            include: {
              owner: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true
                }
              }
            }
          }
        }
      }
    }
  });

  const alreadyInProduction = new Set(
    (
      await prismaClient.releasePrMap.findMany({
        where: {
          release: {
            environment: ReleaseEnvironment.PRODUCTION
          }
        },
        select: {
          prId: true
        }
      })
    ).map((item: { prId: string }) => item.prId)
  );

  const latestByBranch = new Map<string, AutoLinkedPr & { releaseMoment: Date }>();

  for (const stagingRelease of stagingReleases) {
    const releaseMoment = getReleaseMoment(stagingRelease);
    for (const mapping of stagingRelease.releasePrMap as ReleasePrMap[]) {
      const pr = mapping.pr;
      if (!pr) {
        continue;
      }

      if (!pr.owner) {
        continue;
      }

      if (!pr.deployedFlag) {
        continue;
      }

      if (pr.releaseMode !== ReleaseLinkMode.AUTO) {
        continue;
      }

      if (alreadyInProduction.has(pr.id)) {
        continue;
      }

      const key = `${pr.repo}::${pr.branch}`;
      const existing = latestByBranch.get(key);
      if (!existing || existing.releaseMoment.getTime() < releaseMoment.getTime()) {
        latestByBranch.set(key, {
          prId: pr.id,
          repo: pr.repo,
          branch: pr.branch,
          owner: pr.owner,
          releaseMoment
        });
      }
    }
  }

  return [...latestByBranch.values()].map((entry) => ({
    prId: entry.prId,
    repo: entry.repo,
    branch: entry.branch,
    owner: entry.owner
  }));
};

export class ReleasesService {
  async createRelease(input: CreateReleaseInput, actorUserId: string): Promise<ReleaseView> {
    logger.info("Release creation requested", {
      context: LOG_CONTEXT.RELEASE,
      actorUserId,
      environment: input.environment,
      name: input.name,
      releaseDate: input.releaseDate,
      cutoffAt: input.cutoffAt
    });

    const { releaseView, autoLinkedPrs, announcementRecipients } = await prisma.$transaction(
      async (transactionClient) => {
      const releaseRecord = await transactionClient.release.create({
        data: {
          environment: input.environment,
          status: input.status ?? ReleaseStatus.CREATED,
          name: input.name,
          releaseDate: input.releaseDate ? new Date(input.releaseDate) : null,
          cutoffAt: input.cutoffAt ? new Date(input.cutoffAt) : null,
          createdBy: actorUserId
        },
        include: {
          _count: {
            select: {
              releasePrMap: true
            }
          }
        }
      });

      const autoLinkedPrs =
        input.environment === ReleaseEnvironment.STAGING
          ? await findAutoLinkCandidatesForStaging(transactionClient)
          : input.environment === ReleaseEnvironment.PRODUCTION
            ? await (async () => {
                const lastProd = await findLatestProductionRelease(transactionClient);
                const anchorDate = lastProd ? getReleaseMoment(lastProd) : new Date(0);
                return findAutoLinkCandidatesForProduction(anchorDate, transactionClient);
              })()
            : [];

      if (autoLinkedPrs.length) {
        await transactionClient.releasePrMap.createMany({
          data: autoLinkedPrs.map((pr) => ({
            releaseId: releaseRecord.id,
            prId: pr.prId,
            source: ReleasePrSource.AUTO,
            addedBy: actorUserId
          }))
        });
      }

      await createAuditLog(
        {
          entityType: AUDIT_ENTITY.RELEASE,
          entityId: releaseRecord.id,
          action: AUDIT_ACTION.RELEASE_CREATED,
          performedBy: actorUserId,
          metadata: {
            environment: releaseRecord.environment,
            cutoffAt: releaseRecord.cutoffAt,
            releaseDate: releaseRecord.releaseDate,
            autoLinkedCount: autoLinkedPrs.length
          }
        },
        transactionClient
      );

      if (autoLinkedPrs.length) {
        for (const pr of autoLinkedPrs as AutoLinkedPr[]) {
          const prId = pr.prId;
          await createAuditLog(
            {
              entityType: AUDIT_ENTITY.RELEASE_PR_MAP,
              entityId: `${releaseRecord.id}:${prId}`,
              action: AUDIT_ACTION.RELEASE_PR_AUTO_LINKED,
              performedBy: actorUserId,
              metadata: {
                releaseId: releaseRecord.id,
                prId
              }
            },
            transactionClient
          );
        }
      }

      const leadUsers = await findActiveUsersWithPermission(
        PERMISSION_KEY.CAN_MANAGE_RELEASE,
        transactionClient
      );
      const developerUsers = await findActiveUsersWithPermission(
        PERMISSION_KEY.CAN_CREATE_PR,
        transactionClient
      );

      const announcementRecipients = dedupeUsers([...leadUsers, ...developerUsers]);

      await logNotificationOutcomes(
        {
          eventType: NOTIFICATION_EVENT.RELEASE_CREATED,
          recipientIds: announcementRecipients.map((user) => user.id)
        },
        transactionClient
      );

      if (autoLinkedPrs.length) {
        await logNotificationOutcomes(
          {
            eventType: NOTIFICATION_EVENT.RELEASE_PR_AUTO_LINKED,
            recipientIds: autoLinkedPrs.map((pr) => pr.owner.id)
          },
          transactionClient
        );
      }

      return {
        releaseView: toReleaseView(releaseRecord, autoLinkedPrs.length),
        autoLinkedPrs,
        announcementRecipients
      };
    });

    await sendReleaseCreatedEmail(releaseView, announcementRecipients, autoLinkedPrs.length);

    if (autoLinkedPrs.length) {
      await sendPrAutoLinkedEmails(releaseView, autoLinkedPrs);
    }

    return releaseView;
  }

  async listReleases(query: ListReleasesQueryInput): Promise<ReleaseView[]> {
    const releases = await prisma.release.findMany({
      where: {
        ...(query.environment ? { environment: query.environment } : {}),
        ...(query.status ? { status: query.status } : {})
      },
      include: {
        _count: {
          select: {
            releasePrMap: true
          }
        }
      },
      orderBy: [{ releaseDate: "desc" }, { createdAt: "desc" }]
    });

    logger.debug("Releases listed", {
      context: LOG_CONTEXT.RELEASE,
      environmentFilter: query.environment,
      statusFilter: query.status,
      count: releases.length
    });

    return releases.map((release: ReleaseWithCounts): ReleaseView => toReleaseView(release));
  }

  async getReleaseDetail(releaseId: string): Promise<ReleaseDetailView> {
    const release = await findReleaseDetailOrThrow(releaseId, prisma);
    const eligiblePrs = await listEligiblePrsForRelease(release, prisma);
    const linkedPrs = release.releasePrMap.map(toLinkedReleasePrView);
    const autoLinkedCount = linkedPrs.filter((mapping) => mapping.source === ReleasePrSource.AUTO).length;

    logger.debug("Release detail fetched", {
      context: LOG_CONTEXT.RELEASE,
      releaseId,
      linkedPrCount: linkedPrs.length,
      eligiblePrCount: eligiblePrs.length
    });

    return {
      ...toReleaseView(release, autoLinkedCount),
      linkedPrs,
      eligiblePrs
    };
  }

  async addPrToRelease(releaseId: string, input: AddPrToReleaseInput, actorUserId: string): Promise<void> {
    return prisma.$transaction(async (transactionClient) => {
      const release = await findReleaseOrThrow(releaseId, transactionClient);
      ensureCutoffPresent(release);
      ensureCutoffNotPassed(release);

      const existingLink = await transactionClient.releasePrMap.findUnique({
        where: {
          releaseId_prId: {
            releaseId,
            prId: input.prId
          }
        }
      });

      if (existingLink) {
        throw new AppError(RELEASE_ERROR_MESSAGE.PR_ALREADY_LINKED, HTTP_STATUS.CONFLICT);
      }

      const prRecord = await transactionClient.pr.findUnique({
        where: { id: input.prId },
        include: {
          releasePrMap: {
            include: {
              release: {
                select: {
                  environment: true
                }
              }
            }
          }
        }
      });

      if (!prRecord) {
        throw new AppError(RELEASE_ERROR_MESSAGE.PR_NOT_ELIGIBLE, HTTP_STATUS.NOT_FOUND);
      }

      if (release.environment === ReleaseEnvironment.STAGING) {
        if (prRecord.status !== PrStatus.APPROVED && prRecord.status !== PrStatus.DEPLOYED) {
          throw new AppError(RELEASE_ERROR_MESSAGE.PR_NOT_ELIGIBLE, HTTP_STATUS.UNPROCESSABLE_ENTITY);
        }
      }

      if (release.environment === ReleaseEnvironment.PRODUCTION) {
    const wasInStaging = prRecord.releasePrMap.some(
      (mapping: ReleasePrMap) =>
        mapping.release?.environment === ReleaseEnvironment.STAGING
    );
        if (!prRecord.deployedFlag || !wasInStaging) {
          throw new AppError(RELEASE_ERROR_MESSAGE.PR_NOT_ELIGIBLE, HTTP_STATUS.UNPROCESSABLE_ENTITY);
        }
      }

      await transactionClient.releasePrMap.create({
        data: {
          releaseId,
          prId: input.prId,
          addedBy: actorUserId,
          source: input.source ?? ReleasePrSource.MANUAL
        }
      });

      await createAuditLog(
        {
          entityType: AUDIT_ENTITY.RELEASE_PR_MAP,
          entityId: `${releaseId}:${input.prId}`,
          action: AUDIT_ACTION.RELEASE_PR_ADDED,
          performedBy: actorUserId,
          metadata: {
            releaseId,
            prId: input.prId,
            source: input.source ?? ReleasePrSource.MANUAL
          }
        },
        transactionClient
      );
    });
  }

  async removePrFromRelease(releaseId: string, prId: string, actorUserId: string): Promise<void> {
    return prisma.$transaction(async (transactionClient) => {
      const release = await findReleaseOrThrow(releaseId, transactionClient);
      ensureCutoffNotPassed(release);

      const existingLink = await transactionClient.releasePrMap.findUnique({
        where: {
          releaseId_prId: {
            releaseId,
            prId
          }
        }
      });

      if (!existingLink) {
        throw new AppError(RELEASE_ERROR_MESSAGE.PR_NOT_LINKED, HTTP_STATUS.NOT_FOUND);
      }

      await transactionClient.releasePrMap.delete({
        where: {
          releaseId_prId: {
            releaseId,
            prId
          }
        }
      });

      await createAuditLog(
        {
          entityType: AUDIT_ENTITY.RELEASE_PR_MAP,
          entityId: `${releaseId}:${prId}`,
          action: AUDIT_ACTION.RELEASE_PR_REMOVED,
          performedBy: actorUserId,
          metadata: {
            releaseId,
            prId
          }
        },
        transactionClient
      );
    });
  }

  async updateRelease(
    releaseId: string,
    input: UpdateReleaseInput,
    actorUserId: string
  ): Promise<ReleaseView> {
    const release = await prisma.$transaction(async (transactionClient) => {
      const current = await findReleaseOrThrow(releaseId, transactionClient);

      const updated = await transactionClient.release.update({
        where: { id: releaseId },
        data: {
          ...(input.name ? { name: input.name } : {}),
          ...(input.environment ? { environment: input.environment } : {}),
          ...(typeof input.status !== "undefined" ? { status: input.status } : {}),
          ...(input.cutoffAt ? { cutoffAt: new Date(input.cutoffAt) } : {})
        },
        include: {
          _count: {
            select: {
              releasePrMap: true
            }
          }
        }
      });

      await createAuditLog(
        {
          entityType: AUDIT_ENTITY.RELEASE,
          entityId: releaseId,
          action: AUDIT_ACTION.RELEASE_UPDATED,
          performedBy: actorUserId,
          metadata: {
            previousEnvironment: current.environment,
            nextEnvironment: updated.environment,
            previousStatus: current.status,
            nextStatus: updated.status,
            cutoffUpdated: Boolean(input.cutoffAt)
          }
        },
        transactionClient
      );

      return updated;
    });

    return toReleaseView(release);
  }

  async updateReleaseDate(
    releaseId: string,
    input: UpdateReleaseDateInput,
    actorUserId: string
  ): Promise<ReleaseView> {
    const release = await prisma.$transaction(async (transactionClient) => {
      const current = await findReleaseOrThrow(releaseId, transactionClient);

      if (current.environment !== ReleaseEnvironment.PRODUCTION) {
        throw new AppError(RELEASE_ERROR_MESSAGE.RELEASE_ENV_MISMATCH, HTTP_STATUS.UNPROCESSABLE_ENTITY);
      }

      const updated = await transactionClient.release.update({
        where: { id: releaseId },
        data: {
          releaseDate: new Date(input.releaseDate)
        },
        include: {
          _count: {
            select: {
              releasePrMap: true
            }
          }
        }
      });

      await createAuditLog(
        {
          entityType: AUDIT_ENTITY.RELEASE,
          entityId: releaseId,
          action: AUDIT_ACTION.RELEASE_DATE_SET,
          performedBy: actorUserId,
          metadata: {
            previousReleaseDate: current.releaseDate,
            nextReleaseDate: updated.releaseDate
          }
        },
        transactionClient
      );

      return updated;
    });

    return toReleaseView(release);
  }

  async deleteRelease(releaseId: string, actorUserId: string): Promise<void> {
    await prisma.$transaction(async (transactionClient) => {
      await findReleaseOrThrow(releaseId, transactionClient);

      await transactionClient.release.delete({
        where: { id: releaseId }
      });

      await createAuditLog(
        {
          entityType: AUDIT_ENTITY.RELEASE,
          entityId: releaseId,
          action: AUDIT_ACTION.RELEASE_DELETED,
          performedBy: actorUserId
        },
        transactionClient
      );
    });
  }
}
