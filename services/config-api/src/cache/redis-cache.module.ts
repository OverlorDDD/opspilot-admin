import { Global, Module } from "@nestjs/common";
import { RedisCacheService } from "./redis-cache.service";
import { RuntimeConfigCacheService } from "./runtime-config-cache.service";

@Global()
@Module({
  providers: [RedisCacheService, RuntimeConfigCacheService],
  exports: [RedisCacheService, RuntimeConfigCacheService],
})
export class RedisCacheModule {}
