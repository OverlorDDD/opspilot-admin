import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  EnvironmentName,
  RuntimeCacheStatus,
  RuntimeConfigResponse,
} from "@opspilot/contracts";
import { RedisCacheService } from "./redis-cache.service";

export type CachedRuntimeConfig = Omit<RuntimeConfigResponse, "cache">;

export interface RuntimeCacheReadResult {
  status: RuntimeCacheStatus;
  value: CachedRuntimeConfig | null;
}

@Injectable()
export class RuntimeConfigCacheService {
  private readonly logger = new Logger(RuntimeConfigCacheService.name);
  readonly ttlSeconds: number;

  constructor(
    private readonly redis: RedisCacheService,
    configService: ConfigService,
  ) {
    const configuredTtl = Number(
      configService.get<string>("RUNTIME_CACHE_TTL_SECONDS") ?? "60",
    );

    this.ttlSeconds =
      Number.isInteger(configuredTtl) && configuredTtl > 0 ? configuredTtl : 60;
  }

  async read(
    projectId: string,
    environment: EnvironmentName,
  ): Promise<RuntimeCacheReadResult> {
    if (!this.redis.isReady()) {
      return { status: "BYPASS", value: null };
    }

    const key = this.key(projectId, environment);
    const serialized = await this.redis.get(key);

    if (!serialized) {
      return { status: "MISS", value: null };
    }

    try {
      return {
        status: "HIT",
        value: JSON.parse(serialized) as CachedRuntimeConfig,
      };
    } catch {
      this.logger.warn(`Invalid JSON found in Redis for '${key}'. Removing it.`);
      await this.redis.delete(key);
      return { status: "MISS", value: null };
    }
  }

  async write(
    projectId: string,
    environment: EnvironmentName,
    value: CachedRuntimeConfig,
  ): Promise<boolean> {
    return this.redis.set(
      this.key(projectId, environment),
      JSON.stringify(value),
      this.ttlSeconds,
    );
  }

  async invalidate(
    projectId: string,
    environment: EnvironmentName,
  ): Promise<boolean> {
    return this.redis.delete(this.key(projectId, environment));
  }

  private key(projectId: string, environment: EnvironmentName): string {
    return `opspilot:runtime-config:${projectId}:${environment}`;
  }
}
