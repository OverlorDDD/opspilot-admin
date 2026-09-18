import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { ConfigsService } from "./configs.service";
import { RuntimeConfigCacheService } from "../cache/runtime-config-cache.service";

const project = { id: "flowline-service", name: "Flowline Service" };

function makeEntry(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "cfg-max-tasks",
    projectId: project.id,
    environment: "staging",
    name: "limits.maxTasksPerUser",
    type: "number",
    value: 25,
    description: "Maximum number of active tasks.",
    isPublished: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createService() {
  const tx = {
    configEntry: {
      create: jest.fn().mockResolvedValue(makeEntry({ isPublished: false })),
    },
    configRevision: {
      create: jest.fn().mockResolvedValue({
        id: "rev-1",
        configEntryId: "cfg-max-tasks",
        version: 1,
        status: "DRAFT",
      }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({ id: "audit-1" }) },
  };

  const prisma = {
    project: {
      findFirst: jest.fn().mockResolvedValue(project),
      findUnique: jest.fn().mockResolvedValue(project),
      findMany: jest.fn().mockResolvedValue([project]),
    },
    configEntry: {
      findMany: jest.fn().mockResolvedValue([
        makeEntry(),
        makeEntry({
          id: "cfg-maintenance-mode",
          name: "service.maintenanceMode",
          type: "boolean",
          value: false,
        }),
        makeEntry({
          id: "cfg-weekly-digest",
          name: "notifications.weeklyDigest",
          type: "boolean",
          value: true,
          isPublished: false,
        }),
      ]),
      findFirst: jest.fn().mockResolvedValue(makeEntry()),
    },
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };

  const runtimeCache = {
    ttlSeconds: 60,
    read: jest.fn().mockResolvedValue({ status: "MISS", value: null }),
    write: jest.fn().mockResolvedValue(true),
    invalidate: jest.fn().mockResolvedValue(true),
  };

  return {
    service: new ConfigsService(
      prisma as unknown as PrismaService,
      runtimeCache as unknown as RuntimeConfigCacheService,
    ),
    prisma,
    tx,
    runtimeCache,
  };
}

describe("ConfigsService", () => {
  it("returns workspace configuration from the repository", async () => {
    const { service } = createService();

    const result = await service.list("staging");

    expect(result.project.name).toBe("Flowline Service");
    expect(result.total).toBe(3);
  });

  it("uses PostgreSQL on a cache miss, stores the snapshot, and excludes unpublished keys", async () => {
    const { service, prisma, runtimeCache } = createService();

    const result = await service.getRuntime("staging", "flowline-service");

    expect(result.values["limits.maxTasksPerUser"]).toBe(25);
    expect(result.values["service.maintenanceMode"]).toBe(false);
    expect(result.cache.status).toBe("MISS");
    expect(prisma.configEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isPublished: true }),
      }),
    );
    expect(runtimeCache.write).toHaveBeenCalledWith(
      "flowline-service",
      "staging",
      expect.objectContaining({
        environment: "staging",
        values: expect.objectContaining({ "limits.maxTasksPerUser": 25 }),
      }),
    );
  });

  it("returns a Redis cache hit without querying PostgreSQL", async () => {
    const { service, prisma, runtimeCache } = createService();
    runtimeCache.read.mockResolvedValue({
      status: "HIT",
      value: {
        project,
        environment: "staging",
        values: { "limits.maxTasksPerUser": 25 },
        generatedAt: "2026-01-01T00:00:00.000Z",
      },
    });

    const result = await service.getRuntime("staging", "flowline-service");

    expect(result.cache.status).toBe("HIT");
    expect(result.values["limits.maxTasksPerUser"]).toBe(25);
    expect(prisma.configEntry.findMany).not.toHaveBeenCalled();
    expect(runtimeCache.write).not.toHaveBeenCalled();
  });

  it("falls back to PostgreSQL when Redis is unavailable", async () => {
    const { service, runtimeCache } = createService();
    runtimeCache.read.mockResolvedValue({ status: "BYPASS", value: null });
    runtimeCache.write.mockResolvedValue(false);

    const result = await service.getRuntime("staging", "flowline-service");

    expect(result.cache.status).toBe("BYPASS");
    expect(result.values["limits.maxTasksPerUser"]).toBe(25);
  });

  it("rejects a value that does not match its declared type", () => {
    const { service } = createService();

    expect(() => service.validateValue("number", "fast")).toThrow(
      BadRequestException,
    );
  });

  it("creates a new key as an unpublished draft inside a transaction", async () => {
    const { service, tx } = createService();

    const created = await service.create(
      {
        projectId: "flowline-service",
        environment: "staging",
        name: "limits.maxProjects",
        type: "number",
        value: 12,
      },
      "flowline-workspace",
      "user-1",
    );

    expect(created.isPublished).toBe(false);
    expect(tx.configEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPublished: false }),
      }),
    );
    expect(tx.configRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DRAFT", version: 1 }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalled();
  });

  it("throws a not-found error for an unknown key", async () => {
    const { service, prisma } = createService();
    prisma.configEntry.findFirst.mockResolvedValue(null);

    await expect(service.getById("missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
