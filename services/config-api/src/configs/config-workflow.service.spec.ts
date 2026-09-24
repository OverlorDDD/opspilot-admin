import { BadRequestException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { ConfigWorkflowService } from "./config-workflow.service";
import { ConfigsService } from "./configs.service";
import { RuntimeConfigCacheService } from "../cache/runtime-config-cache.service";

const now = new Date("2026-01-01T00:00:00.000Z");
const config = {
  id: "cfg-max-tasks",
  projectId: "flowline-service",
  environment: "staging",
  name: "limits.maxTasksPerUser",
  type: "number",
  value: 25,
  description: "Maximum number of active tasks.",
  isPublished: true,
  createdAt: now,
  updatedAt: now,
};

const approvedRevision = {
  id: "rev-2",
  configEntryId: config.id,
  version: 2,
  status: "APPROVED",
  value: 40,
  description: "Approved increase.",
  rejectionReason: null,
  createdById: "editor-1",
  reviewedById: "approver-1",
  publishedById: null,
  createdAt: now,
  updatedAt: now,
  reviewedAt: now,
  publishedAt: null,
};

function createWorkflowService() {
  const tx = {
    configRevision: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({
        ...approvedRevision,
        status: "PUBLISHED",
        publishedById: "owner-1",
        publishedAt: now,
      }),
      create: jest.fn(),
    },
    configEntry: { update: jest.fn().mockResolvedValue({ ...config, value: 40 }) },
    auditLog: { create: jest.fn().mockResolvedValue({ id: "audit-1" }) },
  };

  const prisma = {
    configEntry: {
      findFirst: jest.fn().mockResolvedValue(config),
    },
    configRevision: {
      findFirst: jest.fn().mockResolvedValue(approvedRevision),
      count: jest.fn().mockResolvedValue(1),
      aggregate: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    auditLog: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };

  const configsService = {
    validateValue: jest.fn(),
  };

  const runtimeCache = {
    ttlSeconds: 60,
    read: jest.fn(),
    write: jest.fn(),
    invalidate: jest.fn().mockResolvedValue(true),
  };

  const service = new ConfigWorkflowService(
    prisma as unknown as PrismaService,
    configsService as unknown as ConfigsService,
    runtimeCache as unknown as RuntimeConfigCacheService,
  );

  return { service, prisma, tx, configsService, runtimeCache };
}

describe("ConfigWorkflowService", () => {
  it("publishes an approved revision atomically and archives the old published revision", async () => {
    const { service, tx, runtimeCache } = createWorkflowService();
    jest.spyOn(service, "getWorkflow").mockResolvedValue({
      config: {
        id: config.id,
        projectId: config.projectId,
        environment: "staging",
        name: config.name,
        type: "number",
        value: 40,
        description: "Approved increase.",
        isPublished: true,
        updatedAt: now.toISOString(),
      },
      activeRevision: null,
      revisions: [],
      audit: [],
    });

    await service.publish(config.id, "flowline-workspace", "owner-1");

    expect(tx.configRevision.updateMany).toHaveBeenCalledWith({
      where: { configEntryId: config.id, status: "PUBLISHED" },
      data: { status: "ARCHIVED" },
    });
    expect(tx.configEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ value: 40, isPublished: true }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "CONFIG_PUBLISHED" }),
      }),
    );
    expect(runtimeCache.invalidate).toHaveBeenCalledWith(
      "flowline-service",
      "staging",
    );
  });

  it("refuses to publish when there is no approved revision", async () => {
    const { service, prisma } = createWorkflowService();
    prisma.configRevision.findFirst.mockResolvedValue(null);

    await expect(
      service.publish(config.id, "flowline-workspace", "owner-1"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("compares two revisions and reports value/description changes", async () => {
    const { service, prisma } = createWorkflowService();
    prisma.configRevision.findMany.mockResolvedValue([
      {
        ...approvedRevision,
        id: "rev-1",
        version: 1,
        status: "ARCHIVED",
        value: 25,
        description: "Old limit.",
      },
      {
        ...approvedRevision,
        id: "rev-2",
        version: 2,
        status: "PUBLISHED",
        value: 40,
        description: "Approved increase.",
      },
    ]);

    const result = await service.compareRevisions(
      config.id,
      "flowline-workspace",
      1,
      2,
    );

    expect(result.hasChanges).toBe(true);
    expect(result.changes.value).toEqual({
      changed: true,
      before: 25,
      after: 40,
    });
    expect(result.changes.description.changed).toBe(true);
  });

  it("restores an archived published version as a new draft instead of changing runtime directly", async () => {
    const { service, prisma, tx } = createWorkflowService();
    const archived = {
      ...approvedRevision,
      id: "rev-1",
      version: 1,
      status: "ARCHIVED",
      value: 25,
      description: "Original limit.",
    };
    const latestPublished = {
      ...approvedRevision,
      id: "rev-2",
      version: 2,
      status: "PUBLISHED",
      value: 40,
    };

    prisma.configRevision.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(archived)
      .mockResolvedValueOnce(latestPublished);
    tx.configRevision.create.mockResolvedValue({
      ...archived,
      id: "rev-3",
      version: 3,
      status: "DRAFT",
      createdById: "editor-1",
    });
    jest.spyOn(service, "getWorkflow").mockResolvedValue({
      config: {
        id: config.id,
        projectId: config.projectId,
        environment: "staging",
        name: config.name,
        type: "number",
        value: 40,
        description: "Approved increase.",
        isPublished: true,
        updatedAt: now.toISOString(),
      },
      activeRevision: null,
      revisions: [],
      audit: [],
    });

    await service.restoreRevisionAsDraft(
      config.id,
      "flowline-workspace",
      "editor-1",
      1,
    );

    expect(tx.configRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        version: 3,
        status: "DRAFT",
        value: 25,
        description: "Original limit.",
      }),
    });
    expect(tx.configEntry.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "DRAFT_CREATED",
          metadata: expect.objectContaining({ source: "rollback", sourceVersion: 1 }),
        }),
      }),
    );
  });

});
