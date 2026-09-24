import {
  MiddlewareConsumer,
  Module,
  NestModule,
} from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { HealthController } from "./health.controller";
import { ConfigsModule } from "./configs/configs.module";
import { PrismaModule } from "./database/prisma.module";
import { RedisCacheModule } from "./cache/redis-cache.module";
import { DispatchModule } from "./dispatch/dispatch.module";
import { IntegrationsModule } from "./integrations/integrations.module";
import { RequestLoggingMiddleware } from "./observability/request-logging.middleware";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
    }),
    PrismaModule,
    RedisCacheModule,
    AuthModule,
    ConfigsModule,
    DispatchModule,
    IntegrationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggingMiddleware).forRoutes("*");
  }
}
