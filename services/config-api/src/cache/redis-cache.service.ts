import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "redis";

@Injectable()
export class RedisCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly client;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>("REDIS_URL") ?? "redis://localhost:6379";

    this.client = createClient({
      url,
      socket: {
        connectTimeout: 1_500,
        reconnectStrategy: false,
      },
    });

    this.client.on("error", (error) => {
      this.logger.warn(`Redis client error: ${this.errorMessage(error)}`);
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.connect();
      this.logger.log("Redis cache connected");
    } catch (error: unknown) {
      this.logger.warn(
        `Redis is unavailable; runtime requests will fall back to PostgreSQL. ${this.errorMessage(error)}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client.isOpen) return;

    try {
      await this.client.quit();
    } catch {
      this.client.destroy();
    }
  }

  isReady(): boolean {
    return this.client.isReady;
  }

  async get(key: string): Promise<string | null> {
    if (!this.client.isReady) return null;

    try {
      return await this.client.get(key);
    } catch (error: unknown) {
      this.logger.warn(`Redis GET failed for '${key}': ${this.errorMessage(error)}`);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    if (!this.client.isReady) return false;

    try {
      await this.client.set(key, value, { EX: ttlSeconds });
      return true;
    } catch (error: unknown) {
      this.logger.warn(`Redis SET failed for '${key}': ${this.errorMessage(error)}`);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.client.isReady) return false;

    try {
      await this.client.del(key);
      return true;
    } catch (error: unknown) {
      this.logger.warn(`Redis DEL failed for '${key}': ${this.errorMessage(error)}`);
      return false;
    }
  }

  async incrementWindow(
    key: string,
    ttlSeconds: number,
  ): Promise<number | null> {
    if (!this.client.isReady) return null;

    try {
      const count = await this.client.incr(key);
      if (count === 1) {
        await this.client.expire(key, ttlSeconds);
      }
      return count;
    } catch (error: unknown) {
      this.logger.warn(
        `Redis INCR failed for '${key}': ${this.errorMessage(error)}`,
      );
      return null;
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
