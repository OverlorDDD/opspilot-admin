import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  CONFIG_KEY_TYPES,
  ConfigEntry as ContractConfigEntry,
  ConfigKeyType,
  ConfigListResponse,
  ConfigValue,
  CreateConfigRequest,
  EnvironmentName,
  ProjectListResponse,
  ProjectSummary,
  RuntimeConfigResponse,
} from "@opspilot/contracts";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import { RuntimeConfigCacheService } from "../cache/runtime-config-cache.service";

const DEFAULT_WORKSPACE_ID = "flowline-workspace";
const DEFAULT_PROJECT_ID = "flowline-service";

@Injectable()
export class ConfigsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runtimeCache: RuntimeConfigCacheService,
  ) {}

  async listProjects(workspaceId: string): Promise<ProjectListResponse> {
    const projects = await this.prisma.project.findMany({
      where: { workspaceId },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    });

    return { items: projects };
  }

  async list(
    environment: EnvironmentName = "staging",
    workspaceId: string = DEFAULT_WORKSPACE_ID,
    projectId?: string,
  ): Promise<ConfigListResponse> {
    const project = await this.getProject(workspaceId, projectId);
    const entries = await this.prisma.configEntry.findMany({
      where: { projectId: project.id, environment },
      orderBy: { name: "asc" },
    });

    const items = entries.map((entry) => this.toContract(entry));
    return { project, items, total: items.length };
  }

  async getRuntime(
    environment: EnvironmentName = "staging",
    projectId: string = DEFAULT_PROJECT_ID,
  ): Promise<RuntimeConfigResponse> {
    return this.getRuntimeForProject(projectId, environment);
  }

  async getRuntimeForWorkspace(
    workspaceId: string,
    environment: EnvironmentName = "staging",
    projectId?: string,
  ): Promise<RuntimeConfigResponse> {
    const project = await this.getProject(workspaceId, projectId);
    return this.getRuntimeForProject(project.id, environment);
  }

  async getRuntimeForProject(
    projectId: string,
    environment: EnvironmentName,
  ): Promise<RuntimeConfigResponse> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });

    if (!project) {
      throw new NotFoundException("Project was not found");
    }

    const cached = await this.runtimeCache.read(project.id, environment);

    if (cached.status === "HIT" && cached.value) {
      return {
        ...cached.value,
        cache: {
          status: "HIT",
          ttlSeconds: this.runtimeCache.ttlSeconds,
        },
      };
    }

    const entries = await this.prisma.configEntry.findMany({
      where: { projectId: project.id, environment, isPublished: true },
      orderBy: { name: "asc" },
    });

    const freshRuntime = {
      project,
      environment,
      values: Object.fromEntries(
        entries.map((entry) => [entry.name, entry.value as ConfigValue]),
      ),
      generatedAt: new Date().toISOString(),
    };

    const stored = await this.runtimeCache.write(
      project.id,
      environment,
      freshRuntime,
    );

    return {
      ...freshRuntime,
      cache: {
        status: cached.status === "BYPASS" || !stored ? "BYPASS" : "MISS",
        ttlSeconds: this.runtimeCache.ttlSeconds,
      },
    };
  }

  async getById(
    id: string,
    workspaceId: string = DEFAULT_WORKSPACE_ID,
  ): Promise<ContractConfigEntry> {
    const entry = await this.prisma.configEntry.findFirst({
      where: { id, project: { workspaceId } },
    });
    if (!entry) {
      throw new NotFoundException(`Config entry '${id}' was not found`);
    }
    return this.toContract(entry);
  }

  async create(
    request: CreateConfigRequest,
    workspaceId: string,
    actorUserId: string,
  ): Promise<ContractConfigEntry> {
    this.validateValue(request.type, request.value, request.name);
    const project = await this.getProject(workspaceId, request.projectId);

    try {
      const entry = await this.prisma.$transaction(async (tx) => {
        const created = await tx.configEntry.create({
          data: {
            id: `cfg-${randomUUID()}`,
            projectId: project.id,
            environment: request.environment,
            name: request.name,
            type: request.type,
            value: request.value as Prisma.InputJsonValue,
            description: request.description ?? "",
            isPublished: false,
          },
        });

        const revision = await tx.configRevision.create({
          data: {
            configEntryId: created.id,
            version: 1,
            status: "DRAFT",
            value: request.value as Prisma.InputJsonValue,
            description: request.description ?? "",
            createdById: actorUserId,
          },
        });

        await tx.auditLog.create({
          data: {
            workspaceId,
            configEntryId: created.id,
            actorUserId,
            action: "CONFIG_CREATED",
            after: {
              name: created.name,
              projectId: project.id,
              environment: created.environment,
              type: created.type,
              version: revision.version,
              status: revision.status,
              value: request.value,
              description: request.description ?? "",
            } as Prisma.InputJsonValue,
          },
        });

        return created;
      });

      return this.toContract(entry);
    } catch (error: unknown) {
      if (this.isPrismaError(error, "P2002")) {
        throw new BadRequestException(
          `Config key '${request.name}' already exists in ${request.environment}`,
        );
      }
      throw error;
    }
  }

  validateValue(
    type: ConfigKeyType,
    value: ConfigValue,
    name?: string,
  ): void {
    if (!CONFIG_KEY_TYPES.includes(type)) {
      throw new BadRequestException(`Unsupported config type '${type}'`);
    }

    const valid =
      (type === "number" && typeof value === "number" && Number.isFinite(value)) ||
      (type === "boolean" && typeof value === "boolean") ||
      (type === "string" && typeof value === "string") ||
      (type === "json" && this.isJsonObject(value));

    if (!valid) {
      throw new BadRequestException(
        `Value does not match the '${type}' schema for this config key`,
      );
    }

    if (
      name === "limits.maxRetries" &&
      (typeof value !== "number" ||
        !Number.isInteger(value) ||
        value < 0 ||
        value > 10)
    ) {
      throw new BadRequestException(
        "limits.maxRetries must be an integer between 0 and 10",
      );
    }

    if (
      name === "limits.maxTasksPerUser" &&
      (typeof value !== "number" ||
        !Number.isInteger(value) ||
        value < 0 ||
        value > 1000)
    ) {
      throw new BadRequestException(
        "limits.maxTasksPerUser must be an integer between 0 and 1000",
      );
    }
  }

  private async getProject(
    workspaceId: string,
    projectId?: string,
  ): Promise<ProjectSummary> {
    const project = await this.prisma.project.findFirst({
      where: {
        workspaceId,
        ...(projectId ? { id: projectId } : {}),
      },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    });

    if (!project) {
      throw new InternalServerErrorException(
        projectId
          ? "Project is missing or does not belong to this workspace."
          : "Workspace project is missing. Run the database seed first.",
      );
    }

    return project;
  }

  private toContract(entry: {
    id: string;
    projectId: string;
    environment: string;
    name: string;
    type: string;
    value: Prisma.JsonValue;
    description: string;
    isPublished: boolean;
    updatedAt: Date;
  }): ContractConfigEntry {
    return {
      id: entry.id,
      projectId: entry.projectId,
      environment: entry.environment as EnvironmentName,
      name: entry.name,
      type: entry.type as ConfigKeyType,
      value: entry.value as ConfigValue,
      description: entry.description,
      isPublished: entry.isPublished,
      updatedAt: entry.updatedAt.toISOString(),
    };
  }

  private isJsonObject(value: ConfigValue): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private isPrismaError(
    error: unknown,
    code: string,
  ): error is Prisma.PrismaClientKnownRequestError {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
  }
}
