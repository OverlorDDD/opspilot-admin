import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { WorkspaceRoleGuard } from "./workspace-role.guard";

function createContext(role?: "owner" | "admin" | "editor" | "approver" | "viewer") {
  const request = role ? { workspace: { role } } : {};
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe("WorkspaceRoleGuard", () => {
  it("allows an endpoint with no role metadata", () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new WorkspaceRoleGuard(reflector);

    expect(guard.canActivate(createContext("viewer"))).toBe(true);
  });

  it("allows a role listed by the endpoint", () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(["viewer"]),
    } as unknown as Reflector;
    const guard = new WorkspaceRoleGuard(reflector);

    expect(guard.canActivate(createContext("viewer"))).toBe(true);
  });

  it("rejects a role that cannot change configuration", () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(["owner", "admin", "editor"]),
    } as unknown as Reflector;
    const guard = new WorkspaceRoleGuard(reflector);

    expect(() => guard.canActivate(createContext("viewer"))).toThrow(
      ForbiddenException,
    );
  });
});
