import { Module } from "@nestjs/common";
import { ConfigsModule } from "../configs/configs.module";
import { PrismaModule } from "../database/prisma.module";
import { DispatchController } from "./dispatch.controller";
import { DispatchService } from "./dispatch.service";

@Module({
  imports: [PrismaModule, ConfigsModule],
  controllers: [DispatchController],
  providers: [DispatchService],
})
export class DispatchModule {}
