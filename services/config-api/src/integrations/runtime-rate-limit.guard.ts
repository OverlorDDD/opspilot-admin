import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RedisCacheService } from "../cache/redis-cache.service";
import type { ServiceAuthenticatedRequest } from "./service-api-key.guard";

@Injectable()
export class RuntimeRateLimitGuard implements CanActivate {
  private readonly limitPerMinute: number;

  constructor(
    private readonly redis: RedisCacheService,
    configService: ConfigService,
  ) {
    const configured = Number(
      configService.get<string>("RUNTIME_RATE_LIMIT_PER_MINUTE") ?? "120",
    );

    this.limitPerMinute =
      Number.isInteger(configured) && configured > 0 ? configured : 120;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request =
      context.switchToHttp().getRequest<ServiceAuthenticatedRequest>();
    const serviceKey = request.serviceKey;

    if (!serviceKey) {
      return true;
    }

    const count = await this.redis.incrementWindow(
      `opspilot:rate:runtime:${serviceKey.id}`,
      60,
    );

    // Redis is an optional dependency for the application. If it is degraded,
    // do not take the customer's runtime path down just because rate limiting
    // cannot be enforced for that minute.
    if (count === null) {
      return true;
    }

    if (count > this.limitPerMinute) {
      throw new HttpException(
        `Runtime API rate limit exceeded (${this.limitPerMinute} requests/minute)`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
