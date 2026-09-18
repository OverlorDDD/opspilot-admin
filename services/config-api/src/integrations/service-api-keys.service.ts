import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  CreateServiceApiKeyResponse,
  EnvironmentName,
  ServiceApiKeyListResponse,
  ServiceApiKeySummary,
} from "@opspilot/contracts";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../database/prisma.service";

export interface ServiceApiKeyContext {
  id: string;
  workspaceId: string;
  projectId: string;
  projectName: string;
  environment: EnvironmentName;
  scope: "runtime:read";
}

@Injectable()
export class ServiceApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    workspaceId: string,
    projectId: string,
    environment: EnvironmentName,
  ): Promise<ServiceApiKeyListResponse> {
    await this.assertProject(workspaceId, projectId);

    const items = await this.prisma.serviceApiKey.findMany({
      where: { workspaceId, projectId, environment },
      include: { project: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    return { items: items.map((item) => this.toSummary(item)) };
  }

  async create(input: {
    workspaceId: string;
    projectId: string;
    environment: EnvironmentName;
    name: string;
    actorUserId: string;
  }): Promise<CreateServiceApiKeyResponse> {
    const project = await this.assertProject(input.workspaceId, input.projectId);
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException("Service key name is required");
    }

    const secret = `opk_${randomBytes(32).toString("base64url")}`;
    const keyHash = this.hash(secret);
    const keyPrefix = secret.slice(0, 12);

    const created = await this.prisma.$transaction(async (tx) => {
      const item = await tx.serviceApiKey.create({
        data: {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          environment: input.environment,
          name,
          keyPrefix,
          keyHash,
          scope: "runtime:read",
          createdById: input.actorUserId,
        },
        include: { project: { select: { name: true } } },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: input.workspaceId,
          actorUserId: input.actorUserId,
          action: "SERVICE_KEY_CREATED",
          metadata: {
            serviceKeyId: item.id,
            projectId: input.projectId,
            projectName: project.name,
            environment: input.environment,
            keyPrefix,
            scope: "runtime:read",
          } as Prisma.InputJsonValue,
        },
      });

      return item;
    });

    return {
      item: this.toSummary(created),
      secret,
    };
  }

  async revoke(input: {
    workspaceId: string;
    serviceKeyId: string;
    actorUserId: string;
  }): Promise<ServiceApiKeySummary> {
    const existing = await this.prisma.serviceApiKey.findFirst({
      where: { id: input.serviceKeyId, workspaceId: input.workspaceId },
      include: { project: { select: { name: true } } },
    });

    if (!existing) {
      throw new NotFoundException("Service API key was not found");
    }

    if (existing.revokedAt) {
      return this.toSummary(existing);
    }

    const revoked = await this.prisma.$transaction(async (tx) => {
      const item = await tx.serviceApiKey.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
        include: { project: { select: { name: true } } },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: input.workspaceId,
          actorUserId: input.actorUserId,
          action: "SERVICE_KEY_REVOKED",
          metadata: {
            serviceKeyId: item.id,
            projectId: item.projectId,
            environment: item.environment,
            keyPrefix: item.keyPrefix,
          } as Prisma.InputJsonValue,
        },
      });

      return item;
    });

    return this.toSummary(revoked);
  }

  async authenticate(secret: string): Promise<ServiceApiKeyContext> {
    if (!secret.startsWith("opk_") || secret.length < 20) {
      throw new UnauthorizedException("Invalid service API key");
    }

    const item = await this.prisma.serviceApiKey.findUnique({
      where: { keyHash: this.hash(secret) },
      include: { project: { select: { name: true } } },
    });

    if (!item || item.revokedAt || item.scope !== "runtime:read") {
      throw new UnauthorizedException("Invalid or revoked service API key");
    }

    await this.prisma.serviceApiKey.update({
      where: { id: item.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      id: item.id,
      workspaceId: item.workspaceId,
      projectId: item.projectId,
      projectName: item.project.name,
      environment: item.environment as EnvironmentName,
      scope: "runtime:read",
    };
  }

  private async assertProject(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      select: { id: true, name: true },
    });

    if (!project) {
      throw new NotFoundException(
        "Project was not found in the current workspace",
      );
    }

    return project;
  }

  private hash(secret: string): string {
    return createHash("sha256").update(secret).digest("hex");
  }

  private toSummary(item: {
    id: string;
    projectId: string;
    environment: string;
    name: string;
    keyPrefix: string;
    scope: string;
    createdAt: Date;
    lastUsedAt: Date | null;
    revokedAt: Date | null;
    project: { name: string };
  }): ServiceApiKeySummary {
    return {
      id: item.id,
      projectId: item.projectId,
      projectName: item.project.name,
      environment: item.environment as EnvironmentName,
      name: item.name,
      keyPrefix: item.keyPrefix,
      scope: "runtime:read",
      createdAt: item.createdAt.toISOString(),
      lastUsedAt: item.lastUsedAt?.toISOString() ?? null,
      revokedAt: item.revokedAt?.toISOString() ?? null,
    };
  }
}
