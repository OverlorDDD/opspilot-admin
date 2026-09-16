import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { HealthController } from "./health.controller";
import { ConfigsModule } from "./configs/configs.module";
import { PrismaModule } from "./database/prisma.module";
import { RedisCacheModule } from "./cache/redis-cache.module";

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
  ],
  controllers: [HealthController],
})
export class AppModule {}
