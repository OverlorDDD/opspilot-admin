import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ConfigEntry,
  ConfigListResponse,
  ConfigRevisionDiffResponse,
  ConfigWorkflowResponse,
  CreateConfigRequest,
  EnvironmentName,
  ProjectListResponse,
  RuntimeConfigResponse,
  UpdateConfigRequest,
} from "@opspilot/contracts";
import {
  AuthenticatedRequest,
  JwtAuthGuard,
} from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { WorkspaceRoleGuard } from "../auth/workspace-role.guard";
import { ConfigWorkflowService } from "./config-workflow.service";
import { ConfigsService } from "./configs.service";
import { CreateConfigDto } from "./dto/create-config.dto";
import { RejectDraftDto } from "./dto/reject-draft.dto";
import { UpdateConfigDto } from "./dto/update-config.dto";

const environments: EnvironmentName[] = [
  "development",
  "staging",
  "production",
];

@Controller("configs")
export class ConfigsController {
  constructor(
    private readonly configsService: ConfigsService,
    private readonly workflowService: ConfigWorkflowService,
  ) {}

  @Get("projects")
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @Roles("owner", "admin", "editor", "approver", "viewer")
  listProjects(
    @Req() request: AuthenticatedRequest,
  ): Promise<ProjectListResponse> {
    return this.configsService.listProjects(request.workspace!.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @Roles("owner", "admin", "editor", "approver", "viewer")
  async list(
    @Req() request: AuthenticatedRequest,
    @Query("environment") environment?: string,
    @Query("projectId") projectId?: string,
  ): Promise<ConfigListResponse> {
    return this.configsService.list(
      this.parseEnvironment(environment),
      request.workspace!.id,
      projectId,
    );
  }

  @Get("runtime")
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @Roles("owner", "admin", "editor", "approver", "viewer")
  async runtime(
    @Query("environment") environment?: string,
    @Query("projectId") projectId?: string,
  ): Promise<RuntimeConfigResponse> {
    return this.configsService.getRuntime(
      this.parseEnvironment(environment),
      projectId,
    );
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @Roles("owner", "admin", "editor", "approver", "viewer")
  async getById(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ConfigEntry> {
    return this.configsService.getById(id, request.workspace!.id);
  }

  @Get(":id/workflow")
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @Roles("owner", "admin", "editor", "approver", "viewer")
  workflow(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ConfigWorkflowResponse> {
    return this.workflowService.getWorkflow(id, request.workspace!.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @Roles("owner", "admin", "editor")
  async create(
    @Body() request: CreateConfigDto,
    @Req() authRequest: AuthenticatedRequest,
  ): Promise<ConfigEntry> {
    return this.configsService.create(
      {
        projectId: request.projectId,
        environment: request.environment,
        name: request.name,
        type: request.type,
        value: request.value as CreateConfigRequest["value"],
        description: request.description,
      },
      authRequest.workspace!.id,
      authRequest.user!.id,
    );
  }

  @Get(":id/diff")
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @Roles("owner", "admin", "editor", "approver", "viewer")
  compareRevisions(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
    @Query("fromVersion") fromVersion?: string,
    @Query("toVersion") toVersion?: string,
  ): Promise<ConfigRevisionDiffResponse> {
    return this.workflowService.compareRevisions(
      id,
      request.workspace!.id,
      this.parseVersion(fromVersion, "fromVersion"),
      this.parseVersion(toVersion, "toVersion"),
    );
  }

  @Post(":id/revisions/:version/restore")
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @Roles("owner", "admin", "editor")
  restoreRevision(
    @Param("id") id: string,
    @Param("version") version: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ConfigWorkflowResponse> {
    return this.workflowService.restoreRevisionAsDraft(
      id,
      request.workspace!.id,
      request.user!.id,
      this.parseVersion(version, "version"),
    );
  }

  @Post(":id/draft")
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @Roles("owner", "admin", "editor")
  createDraft(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ConfigWorkflowResponse> {
    return this.workflowService.createDraft(
      id,
      request.workspace!.id,
      request.user!.id,
    );
  }

  @Patch(":id/draft")
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @Roles("owner", "admin", "editor")
  updateDraft(
    @Param("id") id: string,
    @Body() request: UpdateConfigDto,
    @Req() authRequest: AuthenticatedRequest,
  ): Promise<ConfigWorkflowResponse> {
    return this.workflowService.updateDraft(
      id,
      authRequest.workspace!.id,
      authRequest.user!.id,
      {
        value: request.value as UpdateConfigRequest["value"],
        description: request.description,
      },
    );
  }

  @Post(":id/submit")
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @Roles("owner", "admin", "editor")
  submit(
    @Param("id") id: string,
    @Body() body: UpdateConfigDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ConfigWorkflowResponse> {
    return this.workflowService.submit(
      id,
      request.workspace!.id,
      request.user!.id,
      {
        value: body.value as UpdateConfigRequest["value"],
        description: body.description,
      },
    );
  }

  @Post(":id/approve")
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @Roles("owner", "admin", "approver")
  approve(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ConfigWorkflowResponse> {
    return this.workflowService.approve(
      id,
      request.workspace!.id,
      request.user!.id,
    );
  }

  @Post(":id/reject")
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @Roles("owner", "admin", "approver")
  reject(
    @Param("id") id: string,
    @Body() request: RejectDraftDto,
    @Req() authRequest: AuthenticatedRequest,
  ): Promise<ConfigWorkflowResponse> {
    return this.workflowService.reject(
      id,
      authRequest.workspace!.id,
      authRequest.user!.id,
      request.reason,
    );
  }

  @Post(":id/publish")
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @Roles("owner", "admin")
  publish(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ConfigWorkflowResponse> {
    return this.workflowService.publish(
      id,
      request.workspace!.id,
      request.user!.id,
    );
  }

  private parseVersion(value: string | undefined, fieldName: string): number {
    const version = Number(value);
    if (!Number.isInteger(version) || version < 1) {
      throw new BadRequestException(`${fieldName} must be a positive integer`);
    }
    return version;
  }

  private parseEnvironment(environment?: string): EnvironmentName | undefined {
    if (environment && !environments.includes(environment as EnvironmentName)) {
      throw new BadRequestException(
        `Environment must be one of: ${environments.join(", ")}`,
      );
    }
    return environment as EnvironmentName | undefined;
  }
}
