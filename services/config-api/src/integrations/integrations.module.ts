import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConfigsModule } from "../configs/configs.module";
import { PrismaModule } from "../database/prisma.module";
import { ConsumerRuntimeController } from "./consumer-runtime.controller";
import { ServiceApiKeyGuard } from "./service-api-key.guard";
import { ServiceApiKeysController } from "./service-api-keys.controller";
import { ServiceApiKeysService } from "./service-api-keys.service";
import { RuntimeRateLimitGuard } from "./runtime-rate-limit.guard";

@Module({
  imports: [PrismaModule, AuthModule, ConfigsModule],
  controllers: [ServiceApiKeysController, ConsumerRuntimeController],
  providers: [
    ServiceApiKeysService,
    ServiceApiKeyGuard,
    RuntimeRateLimitGuard,
  ],
  exports: [ServiceApiKeysService],
})
export class IntegrationsModule {}
