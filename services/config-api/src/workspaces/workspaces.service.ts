import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { WorkspaceRole as PrismaWorkspaceRole } from "@prisma/client";
import {
  WorkspaceRole,
  WorkspaceSummary,
  WorkspaceUserAccess,
  WorkspaceUsersResponse,
} from "@opspilot/contracts";
import { PrismaService } from "../database/prisma.service";

const DEFAULT_WORKSPACE_ID = "flowline-workspace";

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The first member of a fresh demo workspace becomes owner. Later demo
   * accounts join Flowline as viewers until an owner/admin grants more access.
   */
  async joinDefaultWorkspace(
    userId: string,
    role: WorkspaceRole = "viewer",
  ): Promise<WorkspaceSummary> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: DEFAULT_WORKSPACE_ID },
    });

    if (!workspace) {
      throw new InternalServerErrorException(
        "Default workspace is missing. Run the database seed first.",
      );
    }

    const memberCount = await this.prisma.workspaceMember.count({
      where: { workspaceId: workspace.id },
    });
    const effectiveRole: WorkspaceRole = memberCount === 0 ? "owner" : role;

    const membership = await this.prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId,
        },
      },
      update: {},
      create: {
        workspaceId: workspace.id,
        userId,
        role: effectiveRole,
      },
      include: { workspace: true },
    });

    return this.toSummary(membership.workspace, membership.role);
  }

  async ensurePrimaryMembership(userId: string): Promise<WorkspaceSummary> {
    // The portfolio demo treats Flowline Operations as the primary shared
    // workspace. If a legacy account also owns an older personal workspace,
    // membership in Flowline takes precedence after an owner adds that user.
    const defaultMembership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          userId,
        },
      },
      include: { workspace: true },
    });

    if (defaultMembership) {
      return this.toSummary(
        defaultMembership.workspace,
        defaultMembership.role,
      );
    }

    const existing = await this.getPrimaryMembership(userId);
    if (existing) {
      return existing;
    }

    return this.joinDefaultWorkspace(userId, "viewer");
  }

  async getPrimaryMembership(
    userId: string,
  ): Promise<WorkspaceSummary | null> {
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { userId },
      include: { workspace: true },
      orderBy: { createdAt: "asc" },
    });

    return membership
      ? this.toSummary(membership.workspace, membership.role)
      : null;
  }

  async listRegisteredUsers(
    workspaceId: string,
    actorRole: WorkspaceRole,
  ): Promise<WorkspaceUsersResponse> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException("Workspace was not found");
    }

    const users = await this.prisma.user.findMany({
      include: {
        memberships: {
          where: { workspaceId },
          select: { role: true, createdAt: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return {
      workspace: this.toSummary(workspace, actorRole),
      users: users.map((user) => {
        const membership = user.memberships[0] ?? null;
        return {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            createdAt: user.createdAt.toISOString(),
          },
          isMember: Boolean(membership),
          role: (membership?.role as WorkspaceRole | undefined) ?? null,
          joinedAt: membership?.createdAt.toISOString() ?? null,
        } satisfies WorkspaceUserAccess;
      }),
    };
  }

  async updateMemberRole(input: {
    workspaceId: string;
    actorUserId: string;
    actorRole: WorkspaceRole;
    targetUserId: string;
    role: WorkspaceRole;
  }): Promise<WorkspaceUserAccess> {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: input.targetUserId },
    });
    if (!targetUser) {
      throw new NotFoundException("User account was not found");
    }

    const existingMembership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: input.workspaceId,
          userId: input.targetUserId,
        },
      },
    });

    if (input.actorUserId === input.targetUserId) {
      throw new BadRequestException(
        "You cannot change your own workspace role",
      );
    }

    // Admins can manage day-to-day roles, but only an owner can create or
    // modify owner/admin memberships. The backend enforces this even if a
    // caller manually crafts an HTTP request.
    if (
      input.actorRole === "admin" &&
      (input.role === "owner" ||
        input.role === "admin" ||
        existingMembership?.role === "owner" ||
        existingMembership?.role === "admin")
    ) {
      throw new ForbiddenException(
        "Only an owner can assign or modify owner/admin roles",
      );
    }

    // Never allow the workspace to end up with zero owners.
    if (existingMembership?.role === "owner" && input.role !== "owner") {
      const ownerCount = await this.prisma.workspaceMember.count({
        where: { workspaceId: input.workspaceId, role: "owner" },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException(
          "The last workspace owner cannot be demoted",
        );
      }
    }

    const membership = await this.prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: input.workspaceId,
          userId: input.targetUserId,
        },
      },
      update: { role: input.role },
      create: {
        workspaceId: input.workspaceId,
        userId: input.targetUserId,
        role: input.role,
      },
    });

    return {
      user: {
        id: targetUser.id,
        email: targetUser.email,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        createdAt: targetUser.createdAt.toISOString(),
      },
      isMember: true,
      role: membership.role as WorkspaceRole,
      joinedAt: membership.createdAt.toISOString(),
    };
  }

  private toSummary(
    workspace: { id: string; name: string; slug: string },
    role: PrismaWorkspaceRole | WorkspaceRole,
  ): WorkspaceSummary {
    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      role: role as WorkspaceRole,
    };
  }
}
