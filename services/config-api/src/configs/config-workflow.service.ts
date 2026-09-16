import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  AuditLogEntry,
  ConfigEntry as ContractConfigEntry,
  ConfigKeyType,
  ConfigRevision as ContractConfigRevision,
  ConfigRevisionDiffResponse,
  ConfigValue,
  ConfigWorkflowResponse,
  EnvironmentName,
} from "@opspilot/contracts";
import { PrismaService } from "../database/prisma.service";
import { RuntimeConfigCacheService } from "../cache/runtime-config-cache.service";
import { ConfigsService } from "./configs.service";

const ACTIVE_STATUSES = ["DRAFT", "PENDING_APPROVAL", "APPROVED"] as const;

@Injectable()
export class ConfigWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configsService: ConfigsService,
    private readonly runtimeCache: RuntimeConfigCacheService,
  ) {}

  async getWorkflow(
    configEntryId: string,
    workspaceId: string,
  ): Promise<ConfigWorkflowResponse> {
    const config = await this.getConfig(configEntryId, workspaceId);
    await this.ensureBaselineRevision(config);

    const [revisions, audit, activeRevision] = await Promise.all([
      this.prisma.configRevision.findMany({
        where: { configEntryId },
        orderBy: { version: "desc" },
      }),
      this.prisma.auditLog.findMany({
        where: { configEntryId, workspaceId },
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      this.prisma.configRevision.findFirst({
        where: {
          configEntryId,
          status: { in: [...ACTIVE_STATUSES] },
        },
        orderBy: { version: "desc" },
      }),
    ]);

    return {
      config: this.toConfigContract(config),
      activeRevision: activeRevision ? this.toRevisionContract(activeRevision) : null,
      revisions: revisions.map((revision) => this.toRevisionContract(revision)),
      audit: audit.map((entry) => this.toAuditContract(entry)),
    };
  }

  async createDraft(
    configEntryId: string,
    workspaceId: string,
    actorUserId: string,
  ): Promise<ConfigWorkflowResponse> {
    const config = await this.getConfig(configEntryId, workspaceId);
    await this.ensureBaselineRevision(config);

    const active = await this.prisma.configRevision.findFirst({
      where: {
        configEntryId,
        status: { in: [...ACTIVE_STATUSES] },
      },
      orderBy: { version: "desc" },
    });

    if (active) {
      throw new BadRequestException(
        `Version ${active.version} is already in ${active.status} state`,
      );
    }

    const latest = await this.prisma.configRevision.findFirst({
      where: { configEntryId },
      orderBy: { version: "desc" },
    });
    const version = (latest?.version ?? 0) + 1;
    const baseValue = config.isPublished ? config.value : (latest?.value ?? config.value);
    const baseDescription = config.isPublished
      ? config.description
      : (latest?.description ?? config.description);

    await this.prisma.$transaction(async (tx) => {
      const revision = await tx.configRevision.create({
        data: {
          configEntryId,
          version,
          status: "DRAFT",
          value: baseValue as Prisma.InputJsonValue,
          description: baseDescription,
          createdById: actorUserId,
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId,
          configEntryId,
          actorUserId,
          action: "DRAFT_CREATED",
          after: this.revisionSnapshot(revision),
        },
      });
    });

    return this.getWorkflow(configEntryId, workspaceId);
  }

  async updateDraft(
    configEntryId: string,
    workspaceId: string,
    actorUserId: string,
    request: { value?: ConfigValue; description?: string },
  ): Promise<ConfigWorkflowResponse> {
    const config = await this.getConfig(configEntryId, workspaceId);
    const draft = await this.findDraft(configEntryId);

    if (request.value !== undefined) {
      this.configsService.validateValue(config.type as ConfigKeyType, request.value);
    }

    const nextValue = request.value ?? (draft.value as ConfigValue);
    const nextDescription = request.description ?? draft.description;

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.configRevision.update({
        where: { id: draft.id },
        data: {
          value: nextValue as Prisma.InputJsonValue,
          description: nextDescription,
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId,
          configEntryId,
          actorUserId,
          action: "DRAFT_UPDATED",
          before: this.revisionSnapshot(draft),
          after: this.revisionSnapshot(updated),
        },
      });
    });

    return this.getWorkflow(configEntryId, workspaceId);
  }

  async submit(
    configEntryId: string,
    workspaceId: string,
    actorUserId: string,
  ): Promise<ConfigWorkflowResponse> {
    await this.getConfig(configEntryId, workspaceId);
    const draft = await this.findDraft(configEntryId);

    await this.transitionWithAudit({
      revisionId: draft.id,
      configEntryId,
      workspaceId,
      actorUserId,
      action: "DRAFT_SUBMITTED",
      before: draft,
      data: { status: "PENDING_APPROVAL" },
    });

    return this.getWorkflow(configEntryId, workspaceId);
  }

  async approve(
    configEntryId: string,
    workspaceId: string,
    actorUserId: string,
  ): Promise<ConfigWorkflowResponse> {
    await this.getConfig(configEntryId, workspaceId);
    const pending = await this.findRevisionByStatus(
      configEntryId,
      "PENDING_APPROVAL",
      "No draft is waiting for approval",
    );

    await this.transitionWithAudit({
      revisionId: pending.id,
      configEntryId,
      workspaceId,
      actorUserId,
      action: "DRAFT_APPROVED",
      before: pending,
      data: {
        status: "APPROVED",
        reviewedById: actorUserId,
        reviewedAt: new Date(),
        rejectionReason: null,
      },
    });

    return this.getWorkflow(configEntryId, workspaceId);
  }

  async reject(
    configEntryId: string,
    workspaceId: string,
    actorUserId: string,
    reason?: string,
  ): Promise<ConfigWorkflowResponse> {
    await this.getConfig(configEntryId, workspaceId);
    const pending = await this.findRevisionByStatus(
      configEntryId,
      "PENDING_APPROVAL",
      "No draft is waiting for approval",
    );

    await this.transitionWithAudit({
      revisionId: pending.id,
      configEntryId,
      workspaceId,
      actorUserId,
      action: "DRAFT_REJECTED",
      before: pending,
      data: {
        status: "REJECTED",
        reviewedById: actorUserId,
        reviewedAt: new Date(),
        rejectionReason: reason?.trim() || null,
      },
    });

    return this.getWorkflow(configEntryId, workspaceId);
  }

  async compareRevisions(
    configEntryId: string,
    workspaceId: string,
    fromVersion: number,
    toVersion: number,
  ): Promise<ConfigRevisionDiffResponse> {
    const config = await this.getConfig(configEntryId, workspaceId);
    await this.ensureBaselineRevision(config);

    const revisions = await this.prisma.configRevision.findMany({
      where: {
        configEntryId,
        version: { in: [fromVersion, toVersion] },
      },
    });

    const from = revisions.find((revision) => revision.version === fromVersion);
    const to = revisions.find((revision) => revision.version === toVersion);

    if (!from) {
      throw new NotFoundException(`Version ${fromVersion} was not found`);
    }
    if (!to) {
      throw new NotFoundException(`Version ${toVersion} was not found`);
    }

    const valueChanged = !this.valuesEqual(from.value, to.value);
    const descriptionChanged = from.description !== to.description;

    return {
      from: this.toRevisionContract(from),
      to: this.toRevisionContract(to),
      hasChanges: valueChanged || descriptionChanged,
      changes: {
        value: {
          changed: valueChanged,
          before: from.value as ConfigValue,
          after: to.value as ConfigValue,
        },
        description: {
          changed: descriptionChanged,
          before: from.description,
          after: to.description,
        },
      },
    };
  }

  async restoreRevisionAsDraft(
    configEntryId: string,
    workspaceId: string,
    actorUserId: string,
    sourceVersion: number,
  ): Promise<ConfigWorkflowResponse> {
    const config = await this.getConfig(configEntryId, workspaceId);
    await this.ensureBaselineRevision(config);

    const active = await this.prisma.configRevision.findFirst({
      where: {
        configEntryId,
        status: { in: [...ACTIVE_STATUSES] },
      },
      orderBy: { version: "desc" },
    });

    if (active) {
      throw new BadRequestException(
        `Version ${active.version} is already in ${active.status} state`,
      );
    }

    const source = await this.prisma.configRevision.findFirst({
      where: { configEntryId, version: sourceVersion },
    });

    if (!source) {
      throw new NotFoundException(`Version ${sourceVersion} was not found`);
    }

    if (source.status !== "ARCHIVED") {
      throw new BadRequestException(
        "Only an archived, previously published version can be restored",
      );
    }

    const latest = await this.prisma.configRevision.findFirst({
      where: { configEntryId },
      orderBy: { version: "desc" },
    });
    const version = (latest?.version ?? 0) + 1;

    await this.prisma.$transaction(async (tx) => {
      const restoredDraft = await tx.configRevision.create({
        data: {
          configEntryId,
          version,
          status: "DRAFT",
          value: source.value as Prisma.InputJsonValue,
          description: source.description,
          createdById: actorUserId,
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId,
          configEntryId,
          actorUserId,
          action: "DRAFT_CREATED",
          after: this.revisionSnapshot(restoredDraft),
          metadata: {
            source: "rollback",
            sourceVersion: source.version,
            sourceRevisionId: source.id,
          },
        },
      });
    });

    return this.getWorkflow(configEntryId, workspaceId);
  }

  async publish(
    configEntryId: string,
    workspaceId: string,
    actorUserId: string,
  ): Promise<ConfigWorkflowResponse> {
    const config = await this.getConfig(configEntryId, workspaceId);
    const approved = await this.findRevisionByStatus(
      configEntryId,
      "APPROVED",
      "No approved draft is ready to publish",
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.configRevision.updateMany({
        where: { configEntryId, status: "PUBLISHED" },
        data: { status: "ARCHIVED" },
      });

      const published = await tx.configRevision.update({
        where: { id: approved.id },
        data: {
          status: "PUBLISHED",
          publishedById: actorUserId,
          publishedAt: new Date(),
        },
      });

      await tx.configEntry.update({
        where: { id: configEntryId },
        data: {
          value: approved.value as Prisma.InputJsonValue,
          description: approved.description,
          isPublished: true,
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId,
          configEntryId,
          actorUserId,
          action: "CONFIG_PUBLISHED",
          before: {
            isPublished: config.isPublished,
            value: config.value,
            description: config.description,
          } as Prisma.InputJsonValue,
          after: this.revisionSnapshot(published),
        },
      });
    });

    await this.runtimeCache.invalidate(config.environment as EnvironmentName);

    return this.getWorkflow(configEntryId, workspaceId);
  }

  private async getConfig(configEntryId: string, workspaceId: string) {
    const config = await this.prisma.configEntry.findFirst({
      where: { id: configEntryId, project: { workspaceId } },
    });

    if (!config) {
      throw new NotFoundException(`Config entry '${configEntryId}' was not found`);
    }

    return config;
  }

  private async ensureBaselineRevision(config: {
    id: string;
    value: Prisma.JsonValue;
    description: string;
    isPublished: boolean;
    updatedAt: Date;
  }): Promise<void> {
    const count = await this.prisma.configRevision.count({
      where: { configEntryId: config.id },
    });

    if (count > 0) return;

    await this.prisma.configRevision.create({
      data: {
        configEntryId: config.id,
        version: 1,
        status: config.isPublished ? "PUBLISHED" : "DRAFT",
        value: config.value as Prisma.InputJsonValue,
        description: config.description,
        publishedAt: config.isPublished ? config.updatedAt : null,
      },
    });
  }

  private async findDraft(configEntryId: string) {
    return this.findRevisionByStatus(
      configEntryId,
      "DRAFT",
      "Create a draft before editing this configuration",
    );
  }

  private async findRevisionByStatus(
    configEntryId: string,
    status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED",
    errorMessage: string,
  ) {
    const revision = await this.prisma.configRevision.findFirst({
      where: { configEntryId, status },
      orderBy: { version: "desc" },
    });

    if (!revision) {
      throw new BadRequestException(errorMessage);
    }

    return revision;
  }

  private async transitionWithAudit(input: {
    revisionId: string;
    configEntryId: string;
    workspaceId: string;
    actorUserId: string;
    action:
      | "DRAFT_SUBMITTED"
      | "DRAFT_APPROVED"
      | "DRAFT_REJECTED";
    before: {
      version: number;
      status: string;
      value: Prisma.JsonValue;
      description: string;
      rejectionReason: string | null;
    };
    data: Prisma.ConfigRevisionUncheckedUpdateInput;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.configRevision.update({
        where: { id: input.revisionId },
        data: input.data,
      });

      await tx.auditLog.create({
        data: {
          workspaceId: input.workspaceId,
          configEntryId: input.configEntryId,
          actorUserId: input.actorUserId,
          action: input.action,
          before: this.revisionSnapshot(input.before),
          after: this.revisionSnapshot(updated),
        },
      });
    });
  }

  private revisionSnapshot(revision: {
    version: number;
    status: string;
    value: Prisma.JsonValue;
    description: string;
    rejectionReason: string | null;
  }): Prisma.InputJsonValue {
    return {
      version: revision.version,
      status: revision.status,
      value: revision.value,
      description: revision.description,
      rejectionReason: revision.rejectionReason,
    } as Prisma.InputJsonValue;
  }

  private valuesEqual(left: Prisma.JsonValue, right: Prisma.JsonValue): boolean {
    return JSON.stringify(this.normalizeJson(left)) === JSON.stringify(this.normalizeJson(right));
  }

  private normalizeJson(value: Prisma.JsonValue | undefined): Prisma.JsonValue {
    if (value === undefined) {
      return null;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeJson(item)) as Prisma.JsonArray;
    }

    if (value !== null && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value)
          .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
          .map(([key, nestedValue]) => [key, this.normalizeJson(nestedValue)]),
      ) as Prisma.JsonObject;
    }

    return value;
  }

  private toConfigContract(config: {
    id: string;
    projectId: string;
    environment: string;
    name: string;
    type: string;
    value: Prisma.JsonValue;
    description: string;
    isPublished: boolean;
    updatedAt: Date;
  }): ContractConfigEntry {
    return {
      id: config.id,
      projectId: config.projectId,
      environment: config.environment as ContractConfigEntry["environment"],
      name: config.name,
      type: config.type as ContractConfigEntry["type"],
      value: config.value as ConfigValue,
      description: config.description,
      isPublished: config.isPublished,
      updatedAt: config.updatedAt.toISOString(),
    };
  }

  private toRevisionContract(revision: {
    id: string;
    configEntryId: string;
    version: number;
    status: string;
    value: Prisma.JsonValue;
    description: string;
    rejectionReason: string | null;
    createdById: string | null;
    reviewedById: string | null;
    publishedById: string | null;
    createdAt: Date;
    updatedAt: Date;
    reviewedAt: Date | null;
    publishedAt: Date | null;
  }): ContractConfigRevision {
    return {
      id: revision.id,
      configEntryId: revision.configEntryId,
      version: revision.version,
      status: revision.status as ContractConfigRevision["status"],
      value: revision.value as ConfigValue,
      description: revision.description,
      rejectionReason: revision.rejectionReason,
      createdById: revision.createdById,
      reviewedById: revision.reviewedById,
      publishedById: revision.publishedById,
      createdAt: revision.createdAt.toISOString(),
      updatedAt: revision.updatedAt.toISOString(),
      reviewedAt: revision.reviewedAt?.toISOString() ?? null,
      publishedAt: revision.publishedAt?.toISOString() ?? null,
    };
  }

  private toAuditContract(entry: {
    id: string;
    action: string;
    configEntryId: string | null;
    actor: {
      id: string;
      email: string;
      firstName: string;
      lastName: string | null;
    } | null;
    before: Prisma.JsonValue | null;
    after: Prisma.JsonValue | null;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
  }): AuditLogEntry {
    return {
      id: entry.id,
      action: entry.action as AuditLogEntry["action"],
      configEntryId: entry.configEntryId,
      actor: entry.actor,
      before: entry.before,
      after: entry.after,
      metadata: entry.metadata,
      createdAt: entry.createdAt.toISOString(),
    };
  }
}
