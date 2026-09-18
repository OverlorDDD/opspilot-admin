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

export interface ProjectSummary {
  id: string;
  name: string;
}

export interface ProjectListResponse {
  items: ProjectSummary[];
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
  "SERVICE_KEY_CREATED",
  "SERVICE_KEY_REVOKED",
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
  project: ProjectSummary;
  items: ConfigEntry[];
  total: number;
}

export type RuntimeCacheStatus = "HIT" | "MISS" | "BYPASS";

export interface RuntimeConfigResponse {
  project: ProjectSummary;
  environment: EnvironmentName;
  values: Record<string, ConfigValue>;
  generatedAt: string;
  cache: {
    status: RuntimeCacheStatus;
    ttlSeconds: number;
  };
}

export interface CreateConfigRequest {
  projectId: string;
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


export type DispatchTaskStatus = "QUEUED" | "IN_PROGRESS" | "DONE";

export interface DispatchTask {
  id: string;
  projectId: string;
  title: string;
  status: DispatchTaskStatus;
  createdAt: string;
  updatedAt: string;
}

export type DispatchEventType =
  | "TASK_CREATED"
  | "TASK_COMPLETED"
  | "DIGEST_QUEUED"
  | "CARRIER_SYNC_SUCCEEDED"
  | "CARRIER_SYNC_FAILED";

export interface DispatchEvent {
  id: string;
  projectId: string;
  type: DispatchEventType;
  message: string;
  metadata: unknown;
  createdAt: string;
}

export interface DispatchStateResponse {
  runtime: RuntimeConfigResponse;
  tasks: DispatchTask[];
  events: DispatchEvent[];
}

export interface CarrierSyncAttempt {
  number: number;
  result: "failed" | "success";
}

export interface CarrierSyncResponse {
  attempts: CarrierSyncAttempt[];
  success: boolean;
  maxRetries: number;
  event: DispatchEvent;
}

export interface DigestQueueResponse {
  message: string;
  event: DispatchEvent;
}


export interface ServiceApiKeySummary {
  id: string;
  projectId: string;
  projectName: string;
  environment: EnvironmentName;
  name: string;
  keyPrefix: string;
  scope: "runtime:read";
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface ServiceApiKeyListResponse {
  items: ServiceApiKeySummary[];
}

export interface CreateServiceApiKeyRequest {
  projectId: string;
  environment: EnvironmentName;
  name: string;
}

export interface CreateServiceApiKeyResponse {
  item: ServiceApiKeySummary;
  secret: string;
}
