import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  WorkspaceUserAccess,
  WorkspaceUsersResponse,
} from "@opspilot/contracts";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { AuthenticatedRequest, JwtAuthGuard } from "./jwt-auth.guard";
import { Roles } from "./roles.decorator";
import { UpdateWorkspaceRoleDto } from "./dto/update-workspace-role.dto";
import { WorkspaceRoleGuard } from "./workspace-role.guard";

@Controller("workspaces/current/users")
@UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
export class WorkspaceAccessController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  @Roles("owner", "admin")
  listUsers(
    @Req() request: AuthenticatedRequest,
  ): Promise<WorkspaceUsersResponse> {
    return this.workspacesService.listRegisteredUsers(
      request.workspace!.id,
      request.workspace!.role,
    );
  }

  @Patch(":userId/role")
  @Roles("owner", "admin")
  updateRole(
    @Param("userId") userId: string,
    @Body() dto: UpdateWorkspaceRoleDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<WorkspaceUserAccess> {
    return this.workspacesService.updateMemberRole({
      workspaceId: request.workspace!.id,
      actorUserId: request.user!.id,
      actorRole: request.workspace!.role,
      targetUserId: userId,
      role: dto.role,
    });
  }
}
