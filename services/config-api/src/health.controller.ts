import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { RedisCacheService } from "./cache/redis-cache.service";
import { PrismaService } from "./database/prisma.service";

@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisCacheService,
  ) {}

  /**
   * Liveness only answers: "is the NestJS process alive enough to respond?"
   * Container orchestrators can use it to decide whether the process should be restarted.
   */
  @Get("live")
  getLiveness(): { status: "ok"; service: string } {
    return {
      status: "ok",
      service: "config-api",
    };
  }

  /**
   * Readiness answers: "can this API really serve requests right now?"
   * PostgreSQL is required, while Redis is optional because the app has a DB fallback.
   */
  @Get("ready")
  async getReadiness(): Promise<{
    status: "ready";
    service: string;
    dependencies: { database: "ready"; redis: "ready" | "degraded" };
  }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new HttpException(
        {
          status: "not_ready",
          service: "config-api",
          dependencies: {
            database: "unavailable",
            redis: this.redis.isReady() ? "ready" : "degraded",
          },
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return {
      status: "ready",
      service: "config-api",
      dependencies: {
        database: "ready",
        redis: this.redis.isReady() ? "ready" : "degraded",
      },
    };
  }

  // Keep the original URL useful for people and simple uptime checks.
  @Get()
  getHealth(): { status: "ok"; service: string } {
    return this.getLiveness();
  }
}
