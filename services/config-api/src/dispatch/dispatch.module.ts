import { Module } from "@nestjs/common";
import { ConfigsModule } from "../configs/configs.module";
import { PrismaModule } from "../database/prisma.module";
import { DispatchController } from "./dispatch.controller";
import { DispatchService } from "./dispatch.service";
import { PortalDemoController } from "./portal-demo.controller";

@Module({
  imports: [PrismaModule, ConfigsModule],
  controllers: [DispatchController, PortalDemoController],
  providers: [DispatchService],
})
export class DispatchModule {}
