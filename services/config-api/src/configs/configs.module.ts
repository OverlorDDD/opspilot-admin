import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../database/prisma.module";
import { ConfigWorkflowService } from "./config-workflow.service";
import { ConfigsController } from "./configs.controller";
import { ConfigsService } from "./configs.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ConfigsController],
  providers: [ConfigsService, ConfigWorkflowService],
  exports: [ConfigsService, ConfigWorkflowService],
})
export class ConfigsModule {}
