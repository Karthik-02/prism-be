import { Prisma, ReleaseEnvironment, ReleaseNoteScope, type PrismaClient } from "@prisma/client";

import { HTTP_STATUS } from "../../config/http.constants";
import { LOG_CONTEXT } from "../../config/log.constants";
import { AppError } from "../../lib/app-error";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { AUDIT_ACTION, AUDIT_ENTITY } from "../audit/audit.constants";
import { createAuditLog } from "../audit/audit.service";
import { NOTIFICATION_EVENT } from "../notifications/notification.constants";
import { logNotificationOutcomes } from "../notifications/notification.service";
import { RELEASE_NOTES_ERROR_MESSAGE } from "./release-notes.constants";
import type {
  GenerateReleaseNotesInput,
  UpdateReleaseNotesInput
} from "./release-notes.schema";

type PrismaClientLike = PrismaClient | Prisma.TransactionClient;

interface ReleaseWithPrs {
  id: string;
  name: string;
  environment: ReleaseEnvironment;
  releaseDate: Date | null;
  cutoffAt: Date | null;
  createdAt: Date;
  releasePrMap: Array<{
    pr: {
      id: string;
      repo: string;
      branch: string;
      prLink: string;
      status: string;
      type: string;
      deployedFlag: boolean;
      owner: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      };
    };
  }>;
}

interface ReleaseNoteView {
  id: string;
  releaseId: string;
  scope: ReleaseNoteScope;
  ownerId: string | null;
  content: string;
  other: Prisma.JsonValue | null;
  version: number;
  updatedAt: string;
}

const findReleaseWithPrsOrThrow = async (
  releaseId: string,
  prismaClient: PrismaClientLike
): Promise<ReleaseWithPrs> => {
  const release = await prismaClient.release.findUnique({
    where: { id: releaseId },
    include: {
      releasePrMap: {
        include: {
          pr: {
            include: {
              owner: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!release) {
    throw new AppError(RELEASE_NOTES_ERROR_MESSAGE.RELEASE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  return release as ReleaseWithPrs;
};

const formatPrLine = (pr: ReleaseWithPrs["releasePrMap"][number]["pr"]): string =>
  `- ${pr.repo}/${pr.branch} [${pr.status}] (${pr.type}) — ${pr.owner.firstName || ""} ${pr.owner.lastName || ""} (${pr.prLink})`;

const buildReleaseNotesContent = (
  release: ReleaseWithPrs,
  prs: ReleaseWithPrs["releasePrMap"],
  other?: Prisma.JsonValue
): string => {
  const header = [
    `# ${release.environment} Release: ${release.name}`,
    `- Release ID: ${release.id}`,
    `- Release Date: ${release.releaseDate ? release.releaseDate.toISOString() : "TBD"}`,
    `- Cutoff: ${release.cutoffAt ? release.cutoffAt.toISOString() : "TBD"}`,
    `- Generated At: ${new Date().toISOString()}`,
    ""
  ];

  const prSection = ["## Pull Requests", ...prs.map((mapping) => formatPrLine(mapping.pr)), ""];

  const otherSection =
    other && Array.isArray(other) && other.length
      ? [
          "## Other",
          ...(other as Array<{ title?: string; content?: string }>).map(
            (entry) => `### ${entry.title ?? "Additional"}\n${entry.content ?? ""}`
          ),
          ""
        ]
      : [];

  return [...header, ...prSection, ...otherSection].join("\n");
};

const toReleaseNoteView = (note: {
  id: string;
  releaseId: string;
  scope: ReleaseNoteScope;
  ownerId: string | null;
  content: string;
  other: Prisma.JsonValue | null;
  version: number;
  updatedAt: Date;
}): ReleaseNoteView => ({
  id: note.id,
  releaseId: note.releaseId,
  scope: note.scope,
  ownerId: note.ownerId,
  content: note.content,
  other: note.other,
  version: note.version,
  updatedAt: note.updatedAt.toISOString()
});

export class ReleaseNotesService {
  private async generateForScope(
    scope: ReleaseNoteScope,
    releaseId: string,
    ownerId: string | null,
    input: GenerateReleaseNotesInput,
    actorUserId: string
  ): Promise<ReleaseNoteView> {
    const release = await findReleaseWithPrsOrThrow(releaseId, prisma);
    const scopedPrs =
      scope === ReleaseNoteScope.OWN && ownerId
        ? release.releasePrMap.filter((mapping) => mapping.pr.owner.id === ownerId)
        : release.releasePrMap;

    const content = buildReleaseNotesContent(release, scopedPrs, input.other);

    const releaseNote = await prisma.releaseNote.upsert({
      where: {
        releaseId_scope_ownerId: {
          releaseId,
          scope,
          ownerId
        }
      },
      update: {
        content,
        ...(typeof input.other !== "undefined" ? { other: input.other } : {}),
        version: { increment: 1 },
        updatedBy: actorUserId
      },
      create: {
        releaseId,
        scope,
        ownerId,
        content,
        other: input.other ?? [],
        createdBy: actorUserId,
        updatedBy: actorUserId
      }
    });

    await createAuditLog(
      {
        entityType: AUDIT_ENTITY.RELEASE_NOTE,
        entityId: releaseNote.id,
        action: AUDIT_ACTION.RELEASE_NOTE_GENERATED,
        performedBy: actorUserId,
        metadata: {
          releaseId,
          scope,
          ownerId
        }
      },
      prisma
    );

    await logNotificationOutcomes(
      {
        eventType: NOTIFICATION_EVENT.RELEASE_NOTE_UPDATED,
        recipientIds: scope === ReleaseNoteScope.FULL ? [] : [ownerId ?? ""]
      },
      prisma
    );

    return toReleaseNoteView(releaseNote);
  }

  async generateOwnReleaseNotes(input: GenerateReleaseNotesInput, actorUserId: string): Promise<ReleaseNoteView> {
    if (!actorUserId) {
      throw new AppError(RELEASE_NOTES_ERROR_MESSAGE.SCOPE_OWNER_REQUIRED, HTTP_STATUS.UNAUTHORIZED);
    }

    logger.info("Generate own release notes", {
      context: LOG_CONTEXT.RELEASE_NOTE,
      releaseId: input.releaseId,
      actorUserId
    });

    return this.generateForScope(ReleaseNoteScope.OWN, input.releaseId, actorUserId, input, actorUserId);
  }

  async generateFullReleaseNotes(
    input: GenerateReleaseNotesInput,
    actorUserId: string
  ): Promise<ReleaseNoteView> {
    logger.info("Generate full release notes", {
      context: LOG_CONTEXT.RELEASE_NOTE,
      releaseId: input.releaseId,
      actorUserId
    });

    return this.generateForScope(ReleaseNoteScope.FULL, input.releaseId, null, input, actorUserId);
  }

  async getOwnReleaseNotes(releaseId: string, actorUserId: string): Promise<ReleaseNoteView> {
    const note = await prisma.releaseNote.findUnique({
      where: {
        releaseId_scope_ownerId: {
          releaseId,
          scope: ReleaseNoteScope.OWN,
          ownerId: actorUserId
        }
      }
    });

    if (!note) {
      return this.generateOwnReleaseNotes({ releaseId }, actorUserId);
    }

    return toReleaseNoteView(note);
  }

  async getFullReleaseNotes(releaseId: string, actorUserId: string): Promise<ReleaseNoteView> {
    const note = await prisma.releaseNote.findUnique({
      where: {
        releaseId_scope_ownerId: {
          releaseId,
          scope: ReleaseNoteScope.FULL,
          ownerId: null
        }
      }
    });

    if (!note) {
      return this.generateFullReleaseNotes({ releaseId }, actorUserId);
    }

    return toReleaseNoteView(note);
  }

  async updateReleaseNotes(
    releaseId: string,
    scope: ReleaseNoteScope,
    ownerId: string | null,
    input: UpdateReleaseNotesInput,
    actorUserId: string
  ): Promise<ReleaseNoteView> {
    if (scope === ReleaseNoteScope.OWN && !ownerId) {
      throw new AppError(RELEASE_NOTES_ERROR_MESSAGE.SCOPE_OWNER_REQUIRED, HTTP_STATUS.BAD_REQUEST);
    }

    const updated = await prisma.$transaction(async (transactionClient) => {
      const current = await transactionClient.releaseNote.findUnique({
        where: {
          releaseId_scope_ownerId: {
            releaseId,
            scope,
            ownerId
          }
        }
      });

      if (!current) {
        throw new AppError(RELEASE_NOTES_ERROR_MESSAGE.RELEASE_NOTE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
      }

      const updateResult = await transactionClient.releaseNote.updateMany({
        where: {
          id: current.id,
          version: input.expectedVersion
        },
        data: {
          content: input.content,
          ...(typeof input.other !== "undefined" ? { other: input.other } : {}),
          version: { increment: 1 },
          updatedBy: actorUserId
        }
      });

      if (updateResult.count === 0) {
        throw new AppError(RELEASE_NOTES_ERROR_MESSAGE.VERSION_CONFLICT, HTTP_STATUS.CONFLICT, {
          currentVersion: current.version
        });
      }

      const refreshed = await transactionClient.releaseNote.findUniqueOrThrow({
        where: { id: current.id }
      });

      await createAuditLog(
        {
          entityType: AUDIT_ENTITY.RELEASE_NOTE,
          entityId: refreshed.id,
          action: AUDIT_ACTION.RELEASE_NOTE_UPDATED,
          performedBy: actorUserId,
          metadata: {
            releaseId,
            scope,
            ownerId,
            previousVersion: current.version,
            nextVersion: refreshed.version
          }
        },
        transactionClient
      );

      await logNotificationOutcomes(
        {
          eventType: NOTIFICATION_EVENT.RELEASE_NOTE_UPDATED,
          recipientIds: scope === ReleaseNoteScope.FULL ? [] : [ownerId ?? ""]
        },
        transactionClient
      );

      return refreshed;
    });

    return toReleaseNoteView(updated);
  }
}
