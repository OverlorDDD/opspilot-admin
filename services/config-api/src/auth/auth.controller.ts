import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { AuthResponse } from "@opspilot/contracts";
import { AuthService } from "./auth.service";
import { AuthenticatedRequest, JwtAuthGuard } from "./jwt-auth.guard";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    return this.authService.register(dto, response);
  }

  @Post("login")
  login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    return this.authService.login(dto, response);
  }

  @Post("logout")
  logout(@Res({ passthrough: true }) response: Response): { ok: true } {
    this.authService.logout(response);
    return { ok: true };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@Req() request: AuthenticatedRequest): Promise<AuthResponse> {
    return this.authService.getCurrentUser(request.user!.id);
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard)
  updateMe(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ): Promise<AuthResponse> {
    return this.authService.updateCurrentUser(request.user!.id, dto);
  }
}
