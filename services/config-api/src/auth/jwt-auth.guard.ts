import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { UserSummary, WorkspaceSummary } from "@opspilot/contracts";
import { AUTH_COOKIE_NAME } from "./auth.constants";
import { UsersService } from "../users/users.service";
import { WorkspacesService } from "../workspaces/workspaces.service";

export type AuthenticatedRequest = Request & {
  cookies?: Record<string, string>;
  user?: UserSummary;
  workspace?: WorkspaceSummary;
};

type AuthTokenPayload = {
  sub: string;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly workspacesService: WorkspacesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();
    const token = request.cookies?.[AUTH_COOKIE_NAME];

    if (!token) {
      throw new UnauthorizedException("Authentication required");
    }

    try {
      const payload = await this.jwtService.verifyAsync<AuthTokenPayload>(token);
      const user = await this.usersService.findPublicById(payload.sub);
      if (!user) {
        throw new UnauthorizedException("User account no longer exists");
      }
      const workspace = await this.workspacesService.ensurePrimaryMembership(user.id);
      request.user = user;
      request.workspace = workspace;
      return true;
    } catch {
      throw new UnauthorizedException("Authentication required");
    }
  }
}
