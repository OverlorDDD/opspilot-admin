import { Module } from "@nestjs/common";
import { PrismaModule } from "../database/prisma.module";
import { WorkspacesService } from "./workspaces.service";

@Module({
  imports: [PrismaModule],
  providers: [WorkspacesService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
