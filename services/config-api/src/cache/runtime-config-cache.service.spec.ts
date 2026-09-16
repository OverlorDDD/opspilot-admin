import { ConfigService } from "@nestjs/config";
import { RedisCacheService } from "./redis-cache.service";
import { RuntimeConfigCacheService } from "./runtime-config-cache.service";

function createService() {
  const redis = {
    isReady: jest.fn().mockReturnValue(true),
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(true),
    delete: jest.fn().mockResolvedValue(true),
  };
  const config = {
    get: jest.fn((key: string) =>
      key === "RUNTIME_CACHE_TTL_SECONDS" ? "60" : undefined,
    ),
  };

  return {
    service: new RuntimeConfigCacheService(
      redis as unknown as RedisCacheService,
      config as unknown as ConfigService,
    ),
    redis,
  };
}

describe("RuntimeConfigCacheService", () => {
  it("reports HIT and parses a cached runtime snapshot", async () => {
    const { service, redis } = createService();
    redis.get.mockResolvedValue(
      JSON.stringify({
        project: { id: "flowline-service", name: "Flowline Service" },
        environment: "staging",
        values: { "limits.maxTasksPerUser": 25 },
        generatedAt: "2026-01-01T00:00:00.000Z",
      }),
    );

    const result = await service.read("staging");

    expect(result.status).toBe("HIT");
    expect(result.value?.values["limits.maxTasksPerUser"]).toBe(25);
  });

  it("reports MISS when the Redis key does not exist", async () => {
    const { service, redis } = createService();
    redis.get.mockResolvedValue(null);

    const result = await service.read("staging");

    expect(result).toEqual({ status: "MISS", value: null });
  });

  it("reports BYPASS when Redis is not ready", async () => {
    const { service, redis } = createService();
    redis.isReady.mockReturnValue(false);

    const result = await service.read("staging");

    expect(result).toEqual({ status: "BYPASS", value: null });
    expect(redis.get).not.toHaveBeenCalled();
  });

  it("deletes the exact environment cache key during invalidation", async () => {
    const { service, redis } = createService();

    await service.invalidate("production");

    expect(redis.delete).toHaveBeenCalledWith(
      "opspilot:runtime-config:production",
    );
  });
});
