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
  RuntimeConfigResponse,
} from "@opspilot/contracts";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import { RuntimeConfigCacheService } from "../cache/runtime-config-cache.service";

const DEFAULT_WORKSPACE_ID = "flowline-workspace";

@Injectable()
export class ConfigsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runtimeCache: RuntimeConfigCacheService,
  ) {}

  async list(
    environment: EnvironmentName = "staging",
    workspaceId: string = DEFAULT_WORKSPACE_ID,
  ): Promise<ConfigListResponse> {
    const project = await this.getProject(workspaceId);
    const entries = await this.prisma.configEntry.findMany({
      where: { projectId: project.id, environment },
      orderBy: { name: "asc" },
    });

    const items = entries.map((entry) => this.toContract(entry));
    return { project, items, total: items.length };
  }

  async getRuntime(
    environment: EnvironmentName = "staging",
  ): Promise<RuntimeConfigResponse> {
    const cached = await this.runtimeCache.read(environment);

    if (cached.status === "HIT" && cached.value) {
      return {
        ...cached.value,
        cache: {
          status: "HIT",
          ttlSeconds: this.runtimeCache.ttlSeconds,
        },
      };
    }

    const response = await this.list(environment, DEFAULT_WORKSPACE_ID);
    const publishedItems = response.items.filter((entry) => entry.isPublished);
    const freshRuntime = {
      project: response.project,
      environment,
      values: Object.fromEntries(
        publishedItems.map((entry) => [entry.name, entry.value]),
      ),
      generatedAt: new Date().toISOString(),
    };

    const stored = await this.runtimeCache.write(environment, freshRuntime);

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
    this.validateValue(request.type, request.value);
    const project = await this.getProject(workspaceId);

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

  validateValue(type: ConfigKeyType, value: ConfigValue): void {
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
  }

  private async getProject(
    workspaceId: string,
  ): Promise<ConfigListResponse["project"]> {
    const project = await this.prisma.project.findFirst({
      where: { workspaceId },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    });

    if (!project) {
      throw new InternalServerErrorException(
        "Workspace project is missing. Run the database seed first.",
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
