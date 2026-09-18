import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { WorkspacesService } from "./workspaces.service";

const workspace = {
  id: "flowline-workspace",
  name: "Flowline Operations",
  slug: "flowline-operations",
};

const user = {
  id: "user-2",
  email: "viewer@example.com",
  passwordHash: "hash",
  firstName: "Viewer",
  lastName: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

function createService() {
  const prisma = {
    workspace: {
      findUnique: jest.fn().mockResolvedValue(workspace),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(user),
      findMany: jest.fn().mockResolvedValue([
        {
          ...user,
          memberships: [],
        },
      ]),
    },
    workspaceMember: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([
        {
          workspaceId: workspace.id,
          userId: user.id,
          role: "viewer",
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
          user,
        },
      ]),
      upsert: jest.fn().mockResolvedValue({
        workspaceId: workspace.id,
        userId: user.id,
        role: "viewer",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        workspace,
      }),
    },
  };

  return {
    service: new WorkspacesService(prisma as unknown as PrismaService),
    prisma,
  };
}

describe("WorkspacesService role administration", () => {

  it("lists only members of the current workspace", async () => {
    const { service, prisma } = createService();

    const result = await service.listRegisteredUsers(workspace.id, "admin");

    expect(prisma.workspaceMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: workspace.id } }),
    );
    expect(result.users).toHaveLength(1);
    expect(result.users[0].user.email).toBe(user.email);
    expect(result.users[0].role).toBe("viewer");
  });

  it("adds a registered user to the workspace with the selected role", async () => {
    const { service, prisma } = createService();
    prisma.workspaceMember.upsert.mockResolvedValue({
      workspaceId: workspace.id,
      userId: user.id,
      role: "editor",
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    const result = await service.updateMemberRole({
      workspaceId: workspace.id,
      actorUserId: "owner-1",
      actorRole: "owner",
      targetUserId: user.id,
      role: "editor",
    });

    expect(result.role).toBe("editor");
    expect(result.isMember).toBe(true);
    expect(prisma.workspaceMember.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ role: "editor" }),
        update: { role: "editor" },
      }),
    );
  });

  it("prevents an admin from assigning the owner role", async () => {
    const { service } = createService();

    await expect(
      service.updateMemberRole({
        workspaceId: workspace.id,
        actorUserId: "admin-1",
        actorRole: "admin",
        targetUserId: user.id,
        role: "owner",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("prevents demoting the last owner", async () => {
    const { service, prisma } = createService();
    prisma.workspaceMember.findUnique.mockResolvedValue({
      workspaceId: workspace.id,
      userId: user.id,
      role: "owner",
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    prisma.workspaceMember.count.mockResolvedValue(1);

    await expect(
      service.updateMemberRole({
        workspaceId: workspace.id,
        actorUserId: "owner-1",
        actorRole: "owner",
        targetUserId: user.id,
        role: "viewer",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
