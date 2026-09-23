import { TooManyRequestsException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ExecutionContext } from "@nestjs/common";
import { RedisCacheService } from "../cache/redis-cache.service";
import { RuntimeRateLimitGuard } from "./runtime-rate-limit.guard";

function contextWithServiceKey(): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        serviceKey: { id: "key-1" },
      }),
    }),
  } as unknown as ExecutionContext;
}

describe("RuntimeRateLimitGuard", () => {
  it("allows requests while the per-minute budget is not exhausted", async () => {
    const redis = {
      incrementWindow: jest.fn().mockResolvedValue(2),
    };
    const config = {
      get: jest.fn().mockReturnValue("3"),
    };

    const guard = new RuntimeRateLimitGuard(
      redis as unknown as RedisCacheService,
      config as unknown as ConfigService,
    );

    await expect(guard.canActivate(contextWithServiceKey())).resolves.toBe(true);
  });

  it("rejects requests after the configured budget", async () => {
    const redis = {
      incrementWindow: jest.fn().mockResolvedValue(4),
    };
    const config = {
      get: jest.fn().mockReturnValue("3"),
    };

    const guard = new RuntimeRateLimitGuard(
      redis as unknown as RedisCacheService,
      config as unknown as ConfigService,
    );

    await expect(
      guard.canActivate(contextWithServiceKey()),
    ).rejects.toBeInstanceOf(TooManyRequestsException);
  });

  it("fails open when Redis is degraded", async () => {
    const redis = {
      incrementWindow: jest.fn().mockResolvedValue(null),
    };
    const config = {
      get: jest.fn().mockReturnValue("3"),
    };

    const guard = new RuntimeRateLimitGuard(
      redis as unknown as RedisCacheService,
      config as unknown as ConfigService,
    );

    await expect(guard.canActivate(contextWithServiceKey())).resolves.toBe(true);
  });
});
