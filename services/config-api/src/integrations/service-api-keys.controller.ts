import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  CreateServiceApiKeyResponse,
  EnvironmentName,
  ServiceApiKeyListResponse,
  ServiceApiKeySummary,
} from "@opspilot/contracts";
import {
  AuthenticatedRequest,
  JwtAuthGuard,
} from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { WorkspaceRoleGuard } from "../auth/workspace-role.guard";
import { CreateServiceApiKeyDto } from "./dto/create-service-api-key.dto";
import { ServiceApiKeysService } from "./service-api-keys.service";

@Controller("integrations/service-keys")
@UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
@Roles("owner", "admin")
export class ServiceApiKeysController {
  constructor(private readonly serviceApiKeys: ServiceApiKeysService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query("projectId") projectId?: string,
    @Query("environment") environment?: string,
  ): Promise<ServiceApiKeyListResponse> {
    if (!projectId) {
      throw new BadRequestException("projectId is required");
    }

    if (
      !environment ||
      !["development", "staging", "production"].includes(environment)
    ) {
      throw new BadRequestException(
        "environment must be development, staging or production",
      );
    }

    return this.serviceApiKeys.list(
      request.workspace!.id,
      projectId,
      environment as EnvironmentName,
    );
  }

  @Post()
  create(
    @Body() body: CreateServiceApiKeyDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<CreateServiceApiKeyResponse> {
    return this.serviceApiKeys.create({
      workspaceId: request.workspace!.id,
      projectId: body.projectId,
      environment: body.environment,
      name: body.name,
      actorUserId: request.user!.id,
    });
  }

  @Post(":id/revoke")
  revoke(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ServiceApiKeySummary> {
    return this.serviceApiKeys.revoke({
      workspaceId: request.workspace!.id,
      serviceKeyId: id,
      actorUserId: request.user!.id,
    });
  }
}
