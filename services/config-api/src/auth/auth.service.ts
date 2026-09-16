import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { Response } from "express";
import { AuthResponse } from "@opspilot/contracts";
import {
  AUTH_COOKIE_MAX_AGE_MS,
  AUTH_COOKIE_NAME,
} from "./auth.constants";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UsersService } from "../users/users.service";
import { WorkspacesService } from "../workspaces/workspaces.service";

type AuthTokenPayload = {
  sub: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly workspacesService: WorkspacesService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto, response: Response): Promise<AuthResponse> {
    const user = await this.usersService.create({
      email: dto.email,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });

    const workspace = await this.workspacesService.joinDefaultWorkspace(
      user.id,
      "viewer",
    );
    await this.setAuthCookie(user.id, response);
    return { user, workspace };
  }

  async login(dto: LoginDto, response: Response): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(dto.email);
    const passwordMatches = user
      ? await this.usersService.checkPassword(dto.password, user.passwordHash)
      : false;

    if (!user || !passwordMatches) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const publicUser = this.usersService.toSummary(user);
    const workspace = await this.workspacesService.ensurePrimaryMembership(
      publicUser.id,
    );
    await this.setAuthCookie(publicUser.id, response);
    return { user: publicUser, workspace };
  }

  logout(response: Response): void {
    response.clearCookie(AUTH_COOKIE_NAME, this.cookieOptions());
  }

  async getCurrentUser(userId: string): Promise<AuthResponse> {
    const user = await this.usersService.findPublicById(userId);
    if (!user) {
      throw new UnauthorizedException("User account no longer exists");
    }
    const workspace = await this.workspacesService.ensurePrimaryMembership(user.id);
    return { user, workspace };
  }

  async updateCurrentUser(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<AuthResponse> {
    const user = await this.usersService.updateProfile(userId, {
      firstName: dto.firstName,
      lastName: dto.lastName,
    });
    const workspace = await this.workspacesService.ensurePrimaryMembership(user.id);
    return { user, workspace };
  }

  private async setAuthCookie(userId: string, response: Response): Promise<void> {
    const token = await this.jwtService.signAsync({ sub: userId });
    response.cookie(AUTH_COOKIE_NAME, token, this.cookieOptions());
  }

  private cookieOptions() {
    const secureSetting = this.configService.get<string>("COOKIE_SECURE");
    const secure =
      secureSetting === undefined
        ? this.configService.get<string>("NODE_ENV") === "production"
        : secureSetting.toLowerCase() === "true";

    return {
      httpOnly: true,
      sameSite: "lax" as const,
      secure,
      maxAge: AUTH_COOKIE_MAX_AGE_MS,
      path: "/",
    };
  }
}
