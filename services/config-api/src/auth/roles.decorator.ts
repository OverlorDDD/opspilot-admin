import { SetMetadata } from "@nestjs/common";
import { WorkspaceRole } from "@opspilot/contracts";

export const WORKSPACE_ROLES_KEY = "workspace_roles";

export const Roles = (...roles: WorkspaceRole[]) =>
  SetMetadata(WORKSPACE_ROLES_KEY, roles);
