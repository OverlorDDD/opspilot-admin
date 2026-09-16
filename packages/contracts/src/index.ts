export const CONFIG_KEY_TYPES = ["number", "boolean", "string", "json"] as const;

export type ConfigKeyType = (typeof CONFIG_KEY_TYPES)[number];

export type ConfigValue = number | boolean | string | Record<string, unknown>;

export type EnvironmentName = "development" | "staging" | "production";

export interface UserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  createdAt: string;
}

export const WORKSPACE_ROLES = [
  "owner",
  "admin",
  "editor",
  "approver",
  "viewer",
] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
}

export interface AuthResponse {
  user: UserSummary;
  workspace: WorkspaceSummary;
}

export interface WorkspaceUserAccess {
  user: UserSummary;
  isMember: boolean;
  role: WorkspaceRole | null;
  joinedAt: string | null;
}

export interface WorkspaceUsersResponse {
  workspace: WorkspaceSummary;
  users: WorkspaceUserAccess[];
}

export interface UpdateWorkspaceMemberRoleRequest {
  role: WorkspaceRole;
}

export interface UpdateProfileRequest {
  firstName: string;
  lastName?: string;
}

export const CONFIG_REVISION_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "PUBLISHED",
  "ARCHIVED",
] as const;

export type ConfigRevisionStatus = (typeof CONFIG_REVISION_STATUSES)[number];

export const AUDIT_ACTIONS = [
  "CONFIG_CREATED",
  "DRAFT_CREATED",
  "DRAFT_UPDATED",
  "DRAFT_SUBMITTED",
  "DRAFT_APPROVED",
  "DRAFT_REJECTED",
  "CONFIG_PUBLISHED",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface ConfigEntry {
  id: string;
  projectId: string;
  environment: EnvironmentName;
  name: string;
  type: ConfigKeyType;
  value: ConfigValue;
  description: string;
  isPublished: boolean;
  updatedAt: string;
}

export interface ConfigRevision {
  id: string;
  configEntryId: string;
  version: number;
  status: ConfigRevisionStatus;
  value: ConfigValue;
  description: string;
  rejectionReason: string | null;
  createdById: string | null;
  reviewedById: string | null;
  publishedById: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  publishedAt: string | null;
}

export interface AuditActorSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
}

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  configEntryId: string | null;
  actor: AuditActorSummary | null;
  before: unknown;
  after: unknown;
  metadata: unknown;
  createdAt: string;
}

export interface ConfigWorkflowResponse {
  config: ConfigEntry;
  activeRevision: ConfigRevision | null;
  revisions: ConfigRevision[];
  audit: AuditLogEntry[];
}

export interface ConfigRevisionDiffResponse {
  from: ConfigRevision;
  to: ConfigRevision;
  hasChanges: boolean;
  changes: {
    value: {
      changed: boolean;
      before: ConfigValue;
      after: ConfigValue;
    };
    description: {
      changed: boolean;
      before: string;
      after: string;
    };
  };
}

export interface ConfigListResponse {
  project: {
    id: string;
    name: string;
  };
  items: ConfigEntry[];
  total: number;
}

export type RuntimeCacheStatus = "HIT" | "MISS" | "BYPASS";

export interface RuntimeConfigResponse {
  project: {
    id: string;
    name: string;
  };
  environment: EnvironmentName;
  values: Record<string, ConfigValue>;
  generatedAt: string;
  cache: {
    status: RuntimeCacheStatus;
    ttlSeconds: number;
  };
}

export interface CreateConfigRequest {
  environment: EnvironmentName;
  name: string;
  type: ConfigKeyType;
  value: ConfigValue;
  description?: string;
}

export interface UpdateConfigRequest {
  value?: ConfigValue;
  description?: string;
}

export interface RejectDraftRequest {
  reason?: string;
}
