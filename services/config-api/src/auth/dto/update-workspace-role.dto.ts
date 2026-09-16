import { IsIn } from "class-validator";
import { WORKSPACE_ROLES, WorkspaceRole } from "@opspilot/contracts";

export class UpdateWorkspaceRoleDto {
  @IsIn([...WORKSPACE_ROLES])
  role!: WorkspaceRole;
}
