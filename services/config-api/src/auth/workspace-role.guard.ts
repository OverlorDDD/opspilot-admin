import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { WorkspaceRole } from "@opspilot/contracts";
import { AuthenticatedRequest } from "./jwt-auth.guard";
import { WORKSPACE_ROLES_KEY } from "./roles.decorator";

@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<WorkspaceRole[]>(
      WORKSPACE_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.workspace) {
      throw new ForbiddenException("Workspace membership is required");
    }

    if (!requiredRoles.includes(request.workspace.role)) {
      throw new ForbiddenException("You do not have permission for this action");
    }

    return true;
  }
}
