import { ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { ConfigsService } from "../configs/configs.service";
import { DispatchService } from "./dispatch.service";

function runtime(values: Record<string, unknown>) {
  return {
    project: { id: "flowline-service", name: "Flowline Dispatch" },
    environment: "staging" as const,
    values,
    generatedAt: "2026-09-18T00:00:00.000Z",
    cache: { status: "HIT" as const, ttlSeconds: 60 },
  };
}

function createService(values: Record<string, unknown>) {
  const prisma = {
    dispatchTask: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    dispatchEvent: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: "event-1",
          ...data,
          createdAt: new Date("2026-09-18T00:00:00.000Z"),
        }),
      ),
    },
    $transaction: jest.fn(),
  };

  const configs = {
    getRuntime: jest.fn().mockResolvedValue(runtime(values)),
  };

  return {
    service: new DispatchService(
      prisma as unknown as PrismaService,
      configs as unknown as ConfigsService,
    ),
    prisma,
    configs,
  };
}

describe("DispatchService runtime policies", () => {
  it("blocks write actions while maintenance mode is published", async () => {
    const { service } = createService({
      "service.maintenanceMode": true,
      "limits.maxTasksPerUser": 25,
    });

    await expect(service.createTask()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it("fails carrier sync when the retry budget is too small", async () => {
    const { service } = createService({
      "service.maintenanceMode": false,
      "limits.maxRetries": 2,
    });

    const result = await service.runCarrierSync();

    expect(result.success).toBe(false);
    expect(result.attempts).toHaveLength(3);
    expect(result.attempts.every((attempt) => attempt.result === "failed")).toBe(
      true,
    );
    expect(result.event.type).toBe("CARRIER_SYNC_FAILED");
  });

  it("succeeds on the fourth attempt when three retries are allowed", async () => {
    const { service } = createService({
      "service.maintenanceMode": false,
      "limits.maxRetries": 3,
    });

    const result = await service.runCarrierSync();

    expect(result.success).toBe(true);
    expect(result.attempts).toHaveLength(4);
    expect(result.attempts[3]).toEqual({ number: 4, result: "success" });
    expect(result.event.type).toBe("CARRIER_SYNC_SUCCEEDED");
  });
});
