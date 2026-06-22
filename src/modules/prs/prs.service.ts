import {
  PrStatus,
  ReleaseEnvironment,
  ReleaseLinkMode,
  ReleasePrSource,
  UserStatus,
  type Prisma,
  type PrismaClient
} from "@prisma/client";

import { EMAIL_CONFIG } from "../../config/email.constants";
import { PERMISSION_KEY } from "../../config/permissions";
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
import { resolveUserPermissionSet } from "../rbac/rbac.service";
import { PRS_ERROR_MESSAGE } from "./prs.constants";
import type {
  AssignPrReviewerInput,
  CreatePrInput,
  ListPrsQueryInput,
  UpdatePrReleaseModeInput,
  UpdatePrStatusInput
} from "./prs.schema";

type PrismaClientLike = PrismaClient | Prisma.TransactionClient;

interface PrWithRelations {
  id: string;
  ownerId: string;
  repo: string;
  branch: string;
  prLink: string;
  reviewerId: string | null;
  status: PrStatus;
  type: string;
  zohoLink: string | null;
  deployedFlag: boolean;
  comments: string;
  releaseMode: ReleaseLinkMode;
  createdAt: Date;
  updatedAt: Date;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  reviewer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  releasePrMap: Array<{
    source: ReleasePrSource;
    createdAt: Date;
    release: {
      id: string;
      name: string;
      environment: ReleaseEnvironment;
      status: string;
    };
  }>;
}

interface ReviewerRecord {
  id: string;
  status: UserStatus;
}

export interface PrView {
  id: string;
  ownerId: string;
  repo: string;
  branch: string;
  prLink: string;
  reviewerId: string | null;
  status: string;
  type: string;
  zohoLink: string | null;
  deployedFlag: boolean;
  comments: string;
  releaseMode: ReleaseLinkMode;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  reviewer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  releaseLinks: Array<{
    releaseId: string;
    releaseName: string;
    environment: ReleaseEnvironment;
    status: string;
    source: ReleasePrSource;
    linkedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

const VALID_PR_STATUS_TRANSITIONS: Record<PrStatus, PrStatus[]> = {
  [PrStatus.SUBMITTED]: [PrStatus.UNDER_REVIEW],
  [PrStatus.UNDER_REVIEW]: [PrStatus.APPROVED, PrStatus.REJECTED, PrStatus.REREVIEW],
  [PrStatus.REREVIEW]: [PrStatus.UNDER_REVIEW, PrStatus.APPROVED, PrStatus.REJECTED],
  [PrStatus.APPROVED]: [PrStatus.DEPLOYED],
  [PrStatus.REJECTED]: [],
  [PrStatus.DEPLOYED]: []
};

const toPrView = (prRecord: PrWithRelations): PrView => ({
  id: prRecord.id,
  ownerId: prRecord.ownerId,
  repo: prRecord.repo,
  branch: prRecord.branch,
  prLink: prRecord.prLink,
  reviewerId: prRecord.reviewerId,
  status: prRecord.status,
  type: prRecord.type,
  zohoLink: prRecord.zohoLink,
  deployedFlag: prRecord.deployedFlag,
  comments: prRecord.comments,
  releaseMode: prRecord.releaseMode,
  owner: prRecord.owner,
  reviewer: prRecord.reviewer,
  releaseLinks: prRecord.releasePrMap.map((mapping) => ({
    releaseId: mapping.release.id,
    releaseName: mapping.release.name,
    environment: mapping.release.environment,
    status: mapping.release.status,
    source: mapping.source,
    linkedAt: mapping.createdAt.toISOString()
  })),
  createdAt: prRecord.createdAt.toISOString(),
  updatedAt: prRecord.updatedAt.toISOString()
});

const findPrById = async (prId: string, prismaClient: PrismaClientLike): Promise<PrWithRelations | null> =>
  prismaClient.pr.findUnique({
    where: {
      id: prId
    },
    include: {
      owner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      reviewer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      releasePrMap: {
        include: {
          release: {
            select: {
              id: true,
              name: true,
              environment: true,
              status: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      }
    }
  });

const getPrOrThrow = async (prId: string, prismaClient: PrismaClientLike): Promise<PrWithRelations> => {
  const prRecord = await findPrById(prId, prismaClient);

  if (!prRecord) {
    throw new AppError(PRS_ERROR_MESSAGE.PR_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  return prRecord;
};

const validatePrStatusTransition = (currentStatus: PrStatus, nextStatus: PrStatus): void => {
  const allowedTransitions = VALID_PR_STATUS_TRANSITIONS[currentStatus];

  if (!allowedTransitions.includes(nextStatus)) {
    throw new AppError(PRS_ERROR_MESSAGE.INVALID_STATUS_TRANSITION, HTTP_STATUS.UNPROCESSABLE_ENTITY, {
      currentStatus,
      nextStatus,
      allowedTransitions
    });
  }
};

const ensureReviewerIsEligible = async (
  reviewerId: string,
  prismaClient: PrismaClientLike
): Promise<ReviewerRecord> => {
  const reviewer = await prismaClient.user.findUnique({
    where: {
      id: reviewerId
    },
    select: {
      id: true,
      status: true
    }
  });

  if (!reviewer) {
    throw new AppError(PRS_ERROR_MESSAGE.REVIEWER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  if (reviewer.status !== UserStatus.ACTIVE) {
    throw new AppError(PRS_ERROR_MESSAGE.REVIEWER_MUST_BE_ACTIVE, HTTP_STATUS.UNPROCESSABLE_ENTITY);
  }

  const reviewerPermissions = await resolveUserPermissionSet(reviewerId, prismaClient);

  if (!reviewerPermissions.has(PERMISSION_KEY.CAN_REVIEW_PR)) {
    throw new AppError(
      PRS_ERROR_MESSAGE.REVIEWER_MUST_HAVE_REVIEW_PERMISSION,
      HTTP_STATUS.UNPROCESSABLE_ENTITY
    );
  }

  return reviewer;
};

const getStatusUpdateRecipientIds = (prRecord: PrWithRelations, actorUserId: string): string[] => {
  const recipientIds = [prRecord.ownerId];

  if (prRecord.reviewerId) {
    recipientIds.push(prRecord.reviewerId);
  }

  return recipientIds.filter((recipientId) => recipientId !== actorUserId);
};

const collectRecipientEmails = (prRecord: PrWithRelations, recipientIds: string[]): string[] => {
  const emailMap = new Map<string, string>();

  emailMap.set(prRecord.ownerId, prRecord.owner.email);
  if (prRecord.reviewerId && prRecord.reviewer) {
    emailMap.set(prRecord.reviewerId, prRecord.reviewer.email);
  }

  return recipientIds
    .map((id) => emailMap.get(id))
    .filter((email): email is string => typeof email === "string");
};

const buildPrDetailRows = (prRecord: PrWithRelations, statusOverride?: PrStatus) => [
  { label: "Repo/Branch", value: `${prRecord.repo} / ${prRecord.branch}` },
  { label: "PR Link", value: prRecord.prLink },
  { label: "Status", value: statusOverride ?? prRecord.status },
  { label: "Type", value: prRecord.type },
  { label: "Owner", value: `${prRecord.owner.firstName} ${prRecord.owner.lastName}`.trim() || prRecord.owner.email },
  {
    label: "Reviewer",
    value: prRecord.reviewer ? `${prRecord.reviewer.firstName} ${prRecord.reviewer.lastName}`.trim() || prRecord.reviewer.email : "Unassigned"
  }
];

const sendPrStatusChangeEmail = async (
  prRecord: PrWithRelations,
  nextStatus: PrStatus,
  actorUserId: string
): Promise<void> => {
  const recipientIds = getStatusUpdateRecipientIds(prRecord, actorUserId);
  const recipients = collectRecipientEmails(prRecord, recipientIds);

  if (!recipients.length) {
    return;
  }

  await sendTemplateEmail({
    to: recipients,
    subject: EMAIL_CONFIG.PR_STATUS_SUBJECT,
    headline: `PR status updated to ${nextStatus}`,
    introLines: [
      `The PR ${prRecord.repo}/${prRecord.branch} was moved to ${nextStatus}.`,
      `Updated by user ${actorUserId}.`
    ],
    detailRows: buildPrDetailRows(prRecord, nextStatus),
    footerLines: ["This is an automated update from PRism."]
  });
};

const sendPrAssignmentEmail = async (
  prRecord: PrWithRelations,
  actorUserId: string
): Promise<void> => {
  if (!prRecord.reviewerId || !prRecord.reviewer) {
    return;
  }

  if (prRecord.reviewerId === actorUserId) {
    return;
  }

  await sendTemplateEmail({
    to: [prRecord.reviewer.email],
    subject: EMAIL_CONFIG.PR_ASSIGNED_SUBJECT,
    headline: "A PR was assigned to you",
    introLines: [
      `You were assigned to review ${prRecord.repo}/${prRecord.branch}.`,
      `Assigned by user ${actorUserId}.`
    ],
    detailRows: buildPrDetailRows(prRecord, prRecord.status),
    footerLines: ["Please review before the release cutoff."]
  });
};

const sendPrSubmittedEmail = async (
  prRecord: PrWithRelations,
  actorUserId: string
): Promise<void> => {
  if (!prRecord.reviewerId || !prRecord.reviewer) {
    return;
  }

  if (prRecord.reviewerId === actorUserId) {
    return;
  }

  await sendTemplateEmail({
    to: [prRecord.reviewer.email],
    subject: EMAIL_CONFIG.PR_ASSIGNED_SUBJECT,
    headline: "New PR submitted for your review",
    introLines: [
      `${prRecord.owner.firstName || "A developer"} submitted a PR for review.`,
      `Submitted by user ${actorUserId}.`
    ],
    detailRows: buildPrDetailRows(prRecord, prRecord.status),
    footerLines: ["This notification was generated automatically."]
  });
};

export class PrsService {
  async createPr(input: CreatePrInput, actorUserId: string): Promise<PrView> {
    logger.info("PR creation requested", {
      context: LOG_CONTEXT.PR,
      actorUserId,
      repo: input.repo,
      branch: input.branch,
      type: input.type,
      releaseMode: input.releaseMode ?? ReleaseLinkMode.MANUAL,
      reviewerId: input.reviewerId
    });

    const { prRecord, prView } = await prisma.$transaction(async (transactionClient) => {
      if (input.reviewerId) {
        await ensureReviewerIsEligible(input.reviewerId, transactionClient);
      }

      const createdPr = await transactionClient.pr.create({
        data: {
          ownerId: actorUserId,
          repo: input.repo,
          branch: input.branch,
          prLink: input.prLink,
          reviewerId: input.reviewerId,
          type: input.type,
          releaseMode: input.releaseMode ?? ReleaseLinkMode.MANUAL,
          zohoLink: input.zohoLink,
          comments: input.comments ?? ""
        },
        select: {
          id: true
        }
      });

      await createAuditLog(
        {
          entityType: AUDIT_ENTITY.PR,
          entityId: createdPr.id,
          action: AUDIT_ACTION.PR_CREATED,
          performedBy: actorUserId,
          metadata: {
            repo: input.repo,
            branch: input.branch,
            status: PrStatus.SUBMITTED,
            type: input.type,
            reviewerId: input.reviewerId ?? null
          }
        },
        transactionClient
      );

      await logNotificationOutcomes(
        {
          eventType: input.reviewerId ? NOTIFICATION_EVENT.PR_ASSIGNED : NOTIFICATION_EVENT.PR_SUBMITTED,
          recipientIds: input.reviewerId ? [input.reviewerId] : []
        },
        transactionClient
      );

      const prRecord = await getPrOrThrow(createdPr.id, transactionClient);

      logger.info("PR created", {
        context: LOG_CONTEXT.PR,
        actorUserId,
        prId: prRecord.id,
        reviewerId: prRecord.reviewerId
      });

      return { prRecord, prView: toPrView(prRecord) };
    });

    await sendPrSubmittedEmail(prRecord, actorUserId);

    return prView;
  }

  async listPrs(
    query: ListPrsQueryInput,
    actorUserId: string,
    canViewAllPrs: boolean
  ): Promise<PrView[]> {
    const filters: Prisma.PrWhereInput[] = [];

    if (query.status) {
      filters.push({ status: query.status });
    }

    if (query.type) {
      filters.push({ type: query.type });
    }

    if (query.reviewerId) {
      filters.push({ reviewerId: query.reviewerId });
    }

    if (query.releaseId || query.releaseEnvironment) {
      filters.push({
        releasePrMap: {
          some: {
            ...(query.releaseId ? { releaseId: query.releaseId } : {}),
            ...(query.releaseEnvironment
              ? {
                  release: {
                    environment: query.releaseEnvironment
                  }
                }
              : {})
          }
        }
      });
    }

    if (canViewAllPrs) {
      if (query.ownerId) {
        filters.push({ ownerId: query.ownerId });
      }
    } else {
      filters.push({ ownerId: actorUserId });
    }

    const whereClause: Prisma.PrWhereInput = filters.length ? { AND: filters } : {};

    const prRecords = await prisma.pr.findMany({
      where: whereClause,
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        releasePrMap: {
          include: {
            release: {
              select: {
                id: true,
                name: true,
                environment: true,
                status: true
              }
            }
          },
          orderBy: {
            createdAt: "desc"
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    logger.debug("PRs listed", {
      context: LOG_CONTEXT.PR,
      actorUserId,
      canViewAllPrs,
      statusFilter: query.status,
      typeFilter: query.type,
      ownerFilter: canViewAllPrs ? query.ownerId : actorUserId,
      reviewerFilter: query.reviewerId,
      releaseFilter: query.releaseId,
      releaseEnvironmentFilter: query.releaseEnvironment,
      totalPrs: prRecords.length
    });

    return prRecords.map(toPrView);
  }

  async updatePrStatus(prId: string, input: UpdatePrStatusInput, actorUserId: string): Promise<PrView> {
    logger.info("PR status update requested", {
      context: LOG_CONTEXT.PR,
      actorUserId,
      prId,
      nextStatus: input.status
    });

    const { prRecord, prView } = await prisma.$transaction(async (transactionClient) => {
      const currentPr = await getPrOrThrow(prId, transactionClient);

      validatePrStatusTransition(currentPr.status, input.status);

      await transactionClient.pr.update({
        where: {
          id: prId
        },
        data: {
          status: input.status,
          deployedFlag: input.status === PrStatus.DEPLOYED ? true : currentPr.deployedFlag,
          ...(typeof input.comments === "string" ? { comments: input.comments } : {})
        }
      });

      const recipientIds = getStatusUpdateRecipientIds(currentPr, actorUserId);
      const notifiedRecipientCount = await logNotificationOutcomes(
        {
          eventType: NOTIFICATION_EVENT.PR_STATUS_UPDATED,
          recipientIds
        },
        transactionClient
      );

      await createAuditLog(
        {
          entityType: AUDIT_ENTITY.PR,
          entityId: prId,
          action: AUDIT_ACTION.PR_STATUS_UPDATED,
          performedBy: actorUserId,
          metadata: {
            previousStatus: currentPr.status,
            nextStatus: input.status,
            commentsUpdated: typeof input.comments === "string",
            notifiedRecipientCount
          }
        },
        transactionClient
      );

      const updatedPr = await getPrOrThrow(prId, transactionClient);

      return { prRecord: updatedPr, prView: toPrView(updatedPr) };
    });

    await sendPrStatusChangeEmail(prRecord, input.status, actorUserId);

    return prView;
  }

  async assignPrReviewer(
    prId: string,
    input: AssignPrReviewerInput,
    actorUserId: string
  ): Promise<PrView> {
    logger.info("PR reviewer assignment requested", {
      context: LOG_CONTEXT.PR,
      actorUserId,
      prId,
      reviewerId: input.reviewerId
    });

    const { prRecord, prView } = await prisma.$transaction(async (transactionClient) => {
      await ensureReviewerIsEligible(input.reviewerId, transactionClient);

      const currentPr = await getPrOrThrow(prId, transactionClient);

      await transactionClient.pr.update({
        where: {
          id: prId
        },
        data: {
          reviewerId: input.reviewerId
        }
      });

      const notifiedRecipientCount = await logNotificationOutcomes(
        {
          eventType: NOTIFICATION_EVENT.PR_ASSIGNED,
          recipientIds: input.reviewerId === actorUserId ? [] : [input.reviewerId]
        },
        transactionClient
      );

      await createAuditLog(
        {
          entityType: AUDIT_ENTITY.PR,
          entityId: prId,
          action: AUDIT_ACTION.PR_REASSIGNED,
          performedBy: actorUserId,
          metadata: {
            previousReviewerId: currentPr.reviewerId,
            nextReviewerId: input.reviewerId,
            notifiedRecipientCount
          }
        },
        transactionClient
      );

      const updatedPr = await getPrOrThrow(prId, transactionClient);

      return { prRecord: updatedPr, prView: toPrView(updatedPr) };
    });

    await sendPrAssignmentEmail(prRecord, actorUserId);

    return prView;
  }

  async updatePrReleaseMode(
    input: UpdatePrReleaseModeInput,
    actorUserId: string,
    canManageAllPrs: boolean
  ): Promise<number> {
    logger.info("PR release mode update requested", {
      context: LOG_CONTEXT.PR,
      actorUserId,
      requestedCount: input.prIds.length,
      mode: input.mode,
      canManageAllPrs
    });

    return prisma.$transaction(async (transactionClient) => {
      const prs = await transactionClient.pr.findMany({
        where: {
          id: {
            in: input.prIds
          }
        },
        select: {
          id: true,
          ownerId: true
        }
      });

      if (prs.length !== input.prIds.length) {
        throw new AppError(PRS_ERROR_MESSAGE.PR_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      }

      type PrOwnerRecord = { id: string; ownerId: string };
      const unauthorizedPr = prs.find(
        (pr: PrOwnerRecord) => pr.ownerId !== actorUserId && !canManageAllPrs
      );

      if (unauthorizedPr) {
        throw new AppError(PRS_ERROR_MESSAGE.FORBIDDEN_PR_ACCESS, HTTP_STATUS.FORBIDDEN);
      }

      await transactionClient.pr.updateMany({
        where: {
          id: {
            in: input.prIds
          }
        },
        data: {
          releaseMode: input.mode
        }
      });

      for (const pr of prs as PrOwnerRecord[]) {
        await createAuditLog(
          {
            entityType: AUDIT_ENTITY.PR,
            entityId: pr.id,
            action: AUDIT_ACTION.PR_RELEASE_MODE_UPDATED,
            performedBy: actorUserId,
            metadata: {
              mode: input.mode
            }
          },
          transactionClient
        );
      }

      return prs.length;
    });
  }
}
