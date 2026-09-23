import { UnauthorizedException } from "@nestjs/common";
import { RedisCacheService } from "../cache/redis-cache.service";
import { PrismaService } from "../database/prisma.service";
import { ServiceApiKeysService } from "./service-api-keys.service";

const project = {
  id: "flowline-service",
  name: "Flowline Dispatch",
};

function createService() {
  const createdAt = new Date("2026-09-18T10:00:00.000Z");
  const tx = {
    serviceApiKey: {
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: "key-1",
          ...data,
          createdAt,
          lastUsedAt: null,
          revokedAt: null,
          project: { name: project.name },
        }),
      ),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  const prisma = {
    project: {
      findFirst: jest.fn().mockResolvedValue(project),
    },
    serviceApiKey: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn().mockImplementation(async (callback) => callback(tx)),
  };

  const redis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
    delete: jest.fn().mockResolvedValue(true),
  };

  return {
    service: new ServiceApiKeysService(
      prisma as unknown as PrismaService,
      redis as unknown as RedisCacheService,
    ),
    prisma,
    redis,
    tx,
  };
}

describe("ServiceApiKeysService", () => {
  it("returns the raw secret once but stores only its SHA-256 hash", async () => {
    const { service, tx } = createService();

    const result = await service.create({
      workspaceId: "flowline-workspace",
      projectId: project.id,
      environment: "production",
      name: "Production consumer",
      actorUserId: "user-1",
    });

    expect(result.secret).toMatch(/^opk_/);
    expect(result.item.keyPrefix).toBe(result.secret.slice(0, 12));

    const createData = tx.serviceApiKey.create.mock.calls[0][0].data;
    expect(createData.keyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createData.keyHash).not.toBe(result.secret);
    expect(createData.scope).toBe("runtime:read");
  });

  it("authenticates an active key and updates lastUsedAt", async () => {
    const { service, prisma, redis } = createService();

    prisma.serviceApiKey.findUnique.mockResolvedValue({
      id: "key-1",
      workspaceId: "flowline-workspace",
      projectId: project.id,
      environment: "staging",
      scope: "runtime:read",
      revokedAt: null,
      project: { name: project.name },
    });

    const context = await service.authenticate(
      "opk_abcdefghijklmnopqrstuvwxyz123456",
    );

    expect(context.projectId).toBe(project.id);
    expect(context.environment).toBe("staging");
    expect(prisma.serviceApiKey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "key-1" },
        data: { lastUsedAt: expect.any(Date) },
      }),
    );
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringContaining("opspilot:service-key-auth:"),
      expect.stringContaining('"projectId":"flowline-service"'),
      60,
    );
  });

  it("serves authentication from Redis without hitting PostgreSQL", async () => {
    const { service, prisma, redis } = createService();

    redis.get.mockResolvedValue(
      JSON.stringify({
        id: "key-1",
        workspaceId: "flowline-workspace",
        projectId: project.id,
        projectName: project.name,
        environment: "staging",
        scope: "runtime:read",
      }),
    );

    const context = await service.authenticate(
      "opk_abcdefghijklmnopqrstuvwxyz123456",
    );

    expect(context.projectId).toBe(project.id);
    expect(prisma.serviceApiKey.findUnique).not.toHaveBeenCalled();
    expect(prisma.serviceApiKey.update).not.toHaveBeenCalled();
  });

  it("rejects a revoked service key", async () => {
    const { service, prisma } = createService();

    prisma.serviceApiKey.findUnique.mockResolvedValue({
      id: "key-1",
      workspaceId: "flowline-workspace",
      projectId: project.id,
      environment: "staging",
      scope: "runtime:read",
      revokedAt: new Date(),
      project: { name: project.name },
    });

    await expect(
      service.authenticate("opk_abcdefghijklmnopqrstuvwxyz123456"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
