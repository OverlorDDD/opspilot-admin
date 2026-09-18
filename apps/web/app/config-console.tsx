"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type {
  ConfigEntry,
  ConfigKeyType,
  ConfigListResponse,
  ConfigRevisionDiffResponse,
  ConfigRevisionStatus,
  ConfigWorkflowResponse,
  EnvironmentName,
  ProjectListResponse,
  RuntimeConfigResponse,
  UserSummary,
  WorkspaceSummary,
} from "@opspilot/contracts";
import { AccountSettings } from "./account-settings";
import { TeamManagement } from "./team-management";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
const environments: EnvironmentName[] = [
  "development",
  "staging",
  "production",
];

type FormState = {
  name: string;
  type: ConfigKeyType;
  value: string;
  description: string;
};

const initialForm: FormState = {
  name: "",
  type: "number",
  value: "",
  description: "",
};

export function ConfigConsole({
  user,
  workspace,
  onLogout,
  onUserUpdated,
}: {
  user: UserSummary;
  workspace: WorkspaceSummary;
  onLogout: () => Promise<void>;
  onUserUpdated: (user: UserSummary) => void;
}) {
  const [environment, setEnvironment] = useState<EnvironmentName>("staging");
  const [projectId, setProjectId] = useState("flowline-service");
  const [projects, setProjects] = useState<ProjectListResponse["items"]>([]);
  const [data, setData] = useState<ConfigListResponse | null>(null);
  const [selected, setSelected] = useState<ConfigEntry | null>(null);
  const [workflow, setWorkflow] = useState<ConfigWorkflowResponse | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(true);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [diff, setDiff] = useState<ConfigRevisionDiffResponse | null>(null);
  const [diffFromVersion, setDiffFromVersion] = useState("");
  const [diffToVersion, setDiffToVersion] = useState("");
  const [diffLoading, setDiffLoading] = useState(false);
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<RuntimeConfigResponse | null>(null);
  const [runtimeLoading, setRuntimeLoading] = useState(false);

  const canEditDrafts = ["owner", "admin", "editor"].includes(workspace.role);
  const canReview = ["owner", "admin", "approver"].includes(workspace.role);
  const canPublish = ["owner", "admin"].includes(workspace.role);
  const activeStatus = workflow?.activeRevision?.status ?? null;
  const isDraftEditable = activeStatus === "DRAFT" && canEditDrafts;

  const loadProjects = useCallback(async () => {
    try {
      const response = await apiRequest<ProjectListResponse>(
        `${API_URL}/configs/projects`,
      );
      setProjects(response.items);
      if (
        response.items.length > 0 &&
        !response.items.some((project) => project.id === projectId)
      ) {
        setProjectId(response.items[0].id);
      }
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }, [projectId]);

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest<ConfigListResponse>(
        `${API_URL}/configs?environment=${environment}&projectId=${encodeURIComponent(projectId)}`,
      );
      setData(response);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [environment, projectId]);

  const loadRuntime = useCallback(async () => {
    setRuntimeLoading(true);
    try {
      const response = await apiRequest<RuntimeConfigResponse>(
        `${API_URL}/configs/runtime?environment=${environment}&projectId=${encodeURIComponent(projectId)}`,
      );
      setRuntimeSnapshot(response);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setRuntimeLoading(false);
    }
  }, [environment, projectId]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    void loadConfigs();
    void loadRuntime();
  }, [loadConfigs, loadRuntime]);

  async function loadWorkflow(entry: ConfigEntry) {
    setWorkflowLoading(true);
    setError(null);
    try {
      const response = await apiRequest<ConfigWorkflowResponse>(
        `${API_URL}/configs/${entry.id}/workflow`,
      );
      setWorkflow(response);
      applyWorkflowToForm(response);
      configureDiffDefaults(response);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setWorkflowLoading(false);
    }
  }

  function applyWorkflowToForm(response: ConfigWorkflowResponse) {
    const source = response.activeRevision ?? response.config;
    setForm({
      name: response.config.name,
      type: response.config.type,
      value: stringifyValue(source.value),
      description: source.description,
    });
  }

  function configureDiffDefaults(response: ConfigWorkflowResponse) {
    setDiff(null);

    const published = response.revisions.find((revision) => revision.status === "PUBLISHED");
    const active = response.activeRevision;

    if (published && active && published.version !== active.version) {
      setDiffFromVersion(String(published.version));
      setDiffToVersion(String(active.version));
      return;
    }

    if (response.revisions.length >= 2) {
      setDiffFromVersion(String(response.revisions[1].version));
      setDiffToVersion(String(response.revisions[0].version));
      return;
    }

    if (response.revisions.length === 1) {
      const version = String(response.revisions[0].version);
      setDiffFromVersion(version);
      setDiffToVersion(version);
      return;
    }

    setDiffFromVersion("");
    setDiffToVersion("");
  }

  function selectEntry(entry: ConfigEntry) {
    setSelected(entry);
    setWorkflow(null);
    setDiff(null);
    setForm({
      name: entry.name,
      type: entry.type,
      value: stringifyValue(entry.value),
      description: entry.description,
    });
    void loadWorkflow(entry);
  }

  function startNewKey() {
    setSelected(null);
    setWorkflow(null);
    setDiff(null);
    setForm(initialForm);
    setError(null);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        value: parseValue(form.value, form.type),
        description: form.description,
      };

      if (!selected) {
        const created = await apiRequest<ConfigEntry>(`${API_URL}/configs`, {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            projectId,
            name: form.name,
            type: form.type,
            environment,
          }),
        });
        setSelected(created);
        await loadConfigs();
        await loadWorkflow(created);
        return;
      }

      if (activeStatus !== "DRAFT") {
        throw new Error("Create a draft before changing this configuration.");
      }

      const response = await apiRequest<ConfigWorkflowResponse>(
        `${API_URL}/configs/${selected.id}/draft`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
      );
      setWorkflow(response);
      applyWorkflowToForm(response);
      configureDiffDefaults(response);
      await loadConfigs();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function runWorkflowAction(
    action: "draft" | "submit" | "approve" | "reject" | "publish",
  ) {
    if (!selected) return;

    setSaving(true);
    setError(null);
    try {
      const body =
        action === "reject"
          ? JSON.stringify({ reason: rejectionReason.trim() || undefined })
          : action === "submit"
            ? JSON.stringify({
                value: parseValue(form.value, form.type),
                description: form.description,
              })
            : undefined;
      const response = await apiRequest<ConfigWorkflowResponse>(
        `${API_URL}/configs/${selected.id}/${action}`,
        { method: "POST", body },
      );
      setWorkflow(response);
      applyWorkflowToForm(response);
      configureDiffDefaults(response);
      await loadConfigs();

      const refreshed = response.config;
      setSelected(refreshed);
      if (action === "reject") setRejectionReason("");
      if (action === "publish") await loadRuntime();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function compareSelectedVersions() {
    if (!selected || !diffFromVersion || !diffToVersion) return;

    setDiffLoading(true);
    setError(null);
    try {
      const response = await apiRequest<ConfigRevisionDiffResponse>(
        `${API_URL}/configs/${selected.id}/diff?fromVersion=${diffFromVersion}&toVersion=${diffToVersion}`,
      );
      setDiff(response);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setDiffLoading(false);
    }
  }

  async function restoreVersionAsDraft(version: number) {
    if (!selected) return;

    setSaving(true);
    setError(null);
    try {
      const response = await apiRequest<ConfigWorkflowResponse>(
        `${API_URL}/configs/${selected.id}/revisions/${version}/restore`,
        { method: "POST" },
      );
      setWorkflow(response);
      applyWorkflowToForm(response);
      configureDiffDefaults(response);
      setSelected(response.config);
      await loadConfigs();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">G</div>
          <div>
            <p className="eyebrow">OPSPILOT ADMIN</p>
            <h1>Service operations console</h1>
          </div>
        </div>
        <div className="environment-picker">
          <label htmlFor="project">Project</label>
          <select
            id="project"
            value={projectId}
            onChange={(event) => {
              setSelected(null);
              setWorkflow(null);
              setDiff(null);
              setForm(initialForm);
              setProjectId(event.target.value);
            }}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
        <div className="environment-picker">
          <label htmlFor="environment">Environment</label>
          <select
            id="environment"
            value={environment}
            onChange={(event) => {
              setSelected(null);
              setWorkflow(null);
              setDiff(null);
              setForm(initialForm);
              setEnvironment(event.target.value as EnvironmentName);
            }}
          >
            {environments.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div className="account-area">
          <div className="workspace-summary">
            <strong>{workspace.name}</strong>
            <span>{workspace.role}</span>
          </div>
          <div className="user-summary">
            <strong>{user.firstName}</strong>
            <span>{user.email}</span>
          </div>
          <a
            className="logout-button nav-link-button"
            href="/demo"
            target="_blank"
            rel="noreferrer"
          >
            Demo client
          </a>
          {["owner", "admin"].includes(workspace.role) && (
            <button
              className="logout-button"
              type="button"
              onClick={() => {
                setShowTeam(!showTeam);
                setShowSettings(false);
              }}
            >
              Users
            </button>
          )}
          <button
            className="logout-button"
            type="button"
            onClick={() => {
              setShowSettings(!showSettings);
              setShowTeam(false);
            }}
          >
            Settings
          </button>
          <button
            className="logout-button"
            type="button"
            onClick={() => void onLogout()}
          >
            Sign out
          </button>
        </div>
      </header>

      {showSettings && (
        <AccountSettings
          user={user}
          onSaved={onUserUpdated}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showTeam && (
        <TeamManagement
          currentUserId={user.id}
          workspace={workspace}
          onClose={() => setShowTeam(false)}
        />
      )}

      <section className="hero-grid">
        <div className="hero-copy">
          <p className="eyebrow accent">{data?.project.name?.toUpperCase() ?? "FLOWLINE PROJECT"}</p>
          <h2>Ship configuration changes with a review trail.</h2>
          <p className="hero-description">
            Draft a change, send it for approval, publish only reviewed values,
            and keep a permanent audit history of every important action.
          </p>
          <div className="hero-meta">
            <span className="status-dot" />
            <span>Control API connected locally</span>
          </div>
        </div>
        <div className="metric-card">
          <span className="metric-label">CONFIGURATION KEYS</span>
          <strong>{data?.total ?? "—"}</strong>
          <span className="metric-caption">keys in {environment}</span>
        </div>
      </section>

      <section className="panel cache-inspector">
        <div className="cache-inspector-copy">
          <p className="eyebrow">RUNTIME CACHE</p>
          <h3>Redis cache inspector</h3>
          <p>
            The runtime endpoint checks Redis before PostgreSQL. Refresh once to
            see a cache HIT; publishing invalidates the cached snapshot.
          </p>
        </div>
        <div className="cache-inspector-stats">
          <div>
            <span>Status</span>
            <strong className={`cache-status ${runtimeSnapshot?.cache.status.toLowerCase() ?? "unknown"}`}>
              {runtimeLoading ? "LOADING" : runtimeSnapshot?.cache.status ?? "—"}
            </strong>
          </div>
          <div>
            <span>Runtime keys</span>
            <strong>{runtimeSnapshot ? Object.keys(runtimeSnapshot.values).length : "—"}</strong>
          </div>
          <div>
            <span>TTL</span>
            <strong>{runtimeSnapshot ? `${runtimeSnapshot.cache.ttlSeconds}s` : "—"}</strong>
          </div>
          <button
            className="secondary-button"
            disabled={runtimeLoading}
            type="button"
            onClick={() => void loadRuntime()}
          >
            {runtimeLoading ? "Checking…" : "Refresh runtime"}
          </button>
        </div>
        {runtimeSnapshot && (
          <p className="cache-generated-at">
            Snapshot generated: {new Date(runtimeSnapshot.generatedAt).toLocaleTimeString()}
          </p>
        )}
      </section>

      {error && (
        <div className="alert" role="alert">
          <strong>Request failed.</strong> {error}
        </div>
      )}

      <section className="content-grid">
        <div className="panel config-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">SERVICE CONFIGURATION</p>
              <h3>Operational parameters</h3>
            </div>
            <button
              className="secondary-button"
              disabled={!canEditDrafts}
              type="button"
              onClick={startNewKey}
            >
              + New key
            </button>
          </div>

          {loading ? (
            <div className="empty-state">Loading configuration registry…</div>
          ) : data?.items.length ? (
            <div className="config-list">
              {data.items.map((entry) => (
                <button
                  className={`config-row ${selected?.id === entry.id ? "selected" : ""}`}
                  key={entry.id}
                  type="button"
                  onClick={() => selectEntry(entry)}
                >
                  <span className="config-icon">{typeIcon(entry.type)}</span>
                  <span className="config-main">
                    <span className="config-name">{entry.name}</span>
                    <span className="config-description">{entry.description}</span>
                  </span>
                  <span className="config-value">{stringifyValue(entry.value)}</span>
                  <span className={`status-badge ${entry.isPublished ? "published" : "draft"}`}>
                    {entry.isPublished ? "published" : "unpublished"}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state">No keys exist in this environment yet.</div>
          )}
        </div>

        <form className="panel editor-panel" onSubmit={handleSave}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">
                {selected ? "CHANGE WORKFLOW" : "NEW CONFIGURATION"}
              </p>
              <h3>{selected ? selected.name : "Create a draft key"}</h3>
            </div>
            <span className={`status-badge ${statusClass(activeStatus)}`}>
              {workflowLoading ? "loading" : statusLabel(activeStatus, selected)}
            </span>
          </div>

          <label className="field">
            <span>Key name</span>
            <input
              required
              disabled={Boolean(selected) || !canEditDrafts}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="car.maxSpeed"
            />
          </label>

          <label className="field">
            <span>Type</span>
            <select
              disabled={Boolean(selected) || !canEditDrafts}
              value={form.type}
              onChange={(event) => {
                const nextType = event.target.value as ConfigKeyType;
                setForm({
                  ...form,
                  type: nextType,
                  value: nextType === "boolean" ? "false" : "",
                });
              }}
            >
              <option value="number">number</option>
              <option value="boolean">boolean</option>
              <option value="string">string</option>
              <option value="json">json</option>
            </select>
          </label>

          <div className="field">
            <span>{selected && !isDraftEditable ? "Current / proposed value" : "Value"}</span>
            {form.type === "boolean" ? (
              <button
                aria-checked={form.value === "true"}
                className={`boolean-toggle ${form.value === "true" ? "on" : "off"}`}
                disabled={Boolean(selected) ? !isDraftEditable : !canEditDrafts}
                role="switch"
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    value: form.value === "true" ? "false" : "true",
                  })
                }
              >
                <span className="boolean-toggle-track" aria-hidden="true">
                  <span className="boolean-toggle-thumb" />
                </span>
                <span className="boolean-toggle-copy">
                  <strong>{form.value === "true" ? "true" : "false"}</strong>
                  <small>Click the switch to change this boolean value.</small>
                </span>
              </button>
            ) : (
              <input
                required
                disabled={Boolean(selected) ? !isDraftEditable : !canEditDrafts}
                value={form.value}
                onChange={(event) => setForm({ ...form, value: event.target.value })}
                placeholder={valuePlaceholder(form.type)}
              />
            )}
          </div>

          <label className="field">
            <span>Description</span>
            <textarea
              rows={3}
              disabled={Boolean(selected) ? !isDraftEditable : !canEditDrafts}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Explain why this value exists."
            />
          </label>

          <div className="workflow-note">
            {workflowMessage(activeStatus, selected, workspace.role)}
          </div>

          {selected && activeStatus === "PENDING_APPROVAL" && canReview && (
            <label className="field rejection-field">
              <span>Rejection reason (optional)</span>
              <textarea
                rows={2}
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                placeholder="Explain what should be changed before the next review."
              />
            </label>
          )}

          <div className="workflow-actions">
            {!selected && (
              <button
                className="primary-button"
                disabled={saving || !canEditDrafts}
                type="submit"
              >
                {saving ? "Creating…" : "Create draft"}
              </button>
            )}

            {selected && !activeStatus && canEditDrafts && (
              <button
                className="secondary-button"
                disabled={saving}
                type="button"
                onClick={() => void runWorkflowAction("draft")}
              >
                Start new draft
              </button>
            )}

            {selected && activeStatus === "DRAFT" && canEditDrafts && (
              <>
                <button
                  className="primary-button"
                  disabled={saving}
                  type="button"
                  onClick={() => void runWorkflowAction("submit")}
                >
                  {saving ? "Submitting…" : "Submit for approval"}
                </button>
              </>
            )}

            {selected && activeStatus === "PENDING_APPROVAL" && canReview && (
              <>
                <button
                  className="danger-button"
                  disabled={saving}
                  type="button"
                  onClick={() => void runWorkflowAction("reject")}
                >
                  Reject
                </button>
                <button
                  className="primary-button"
                  disabled={saving}
                  type="button"
                  onClick={() => void runWorkflowAction("approve")}
                >
                  Approve
                </button>
              </>
            )}

            {selected && activeStatus === "APPROVED" && canPublish && (
              <button
                className="primary-button"
                disabled={saving}
                type="button"
                onClick={() => void runWorkflowAction("publish")}
              >
                Publish approved version
              </button>
            )}
          </div>
        </form>
      </section>

      {selected && workflow && (
        <section className="history-grid">
          <div className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">VERSION HISTORY</p>
                <h3>Revisions</h3>
              </div>
            </div>
            {workflow.revisions.length > 0 && (
              <div className="diff-tool">
                <div className="diff-controls">
                  <label>
                    <span>From</span>
                    <select
                      value={diffFromVersion}
                      onChange={(event) => {
                        setDiffFromVersion(event.target.value);
                        setDiff(null);
                      }}
                    >
                      {workflow.revisions.map((revision) => (
                        <option key={`from-${revision.id}`} value={revision.version}>
                          v{revision.version} · {revision.status.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="diff-arrow">→</span>
                  <label>
                    <span>To</span>
                    <select
                      value={diffToVersion}
                      onChange={(event) => {
                        setDiffToVersion(event.target.value);
                        setDiff(null);
                      }}
                    >
                      {workflow.revisions.map((revision) => (
                        <option key={`to-${revision.id}`} value={revision.version}>
                          v{revision.version} · {revision.status.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={diffLoading || !diffFromVersion || !diffToVersion}
                    onClick={() => void compareSelectedVersions()}
                  >
                    {diffLoading ? "Comparing…" : "Compare"}
                  </button>
                </div>

                {diff && (
                  <div className="diff-result">
                    <div className="diff-summary">
                      <strong>v{diff.from.version} → v{diff.to.version}</strong>
                      <span>{diff.hasChanges ? "Changes found" : "No differences"}</span>
                    </div>
                    <DiffRow
                      label="Value"
                      changed={diff.changes.value.changed}
                      before={stringifyValue(diff.changes.value.before)}
                      after={stringifyValue(diff.changes.value.after)}
                    />
                    <DiffRow
                      label="Description"
                      changed={diff.changes.description.changed}
                      before={diff.changes.description.before || "(empty)"}
                      after={diff.changes.description.after || "(empty)"}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="timeline-list">
              {workflow.revisions.map((revision) => (
                <div className="timeline-row" key={revision.id}>
                  <div>
                    <strong>Version {revision.version}</strong>
                    <span>{stringifyValue(revision.value)}</span>
                  </div>
                  <div className="revision-actions">
                    <span className={`status-badge ${statusClass(revision.status)}`}>
                      {revision.status.replaceAll("_", " ")}
                    </span>
                    {revision.status === "ARCHIVED" && !activeStatus && canEditDrafts && (
                      <button
                        className="restore-button"
                        disabled={saving}
                        type="button"
                        onClick={() => void restoreVersionAsDraft(revision.version)}
                      >
                        Restore as draft
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">AUDIT LOG</p>
                <h3>Who changed what</h3>
              </div>
            </div>
            <div className="timeline-list">
              {workflow.audit.length ? (
                workflow.audit.map((event) => (
                  <div className="audit-row" key={event.id}>
                    <div>
                      <strong>{auditLabel(event.action, event.metadata)}</strong>
                      <span>
                        {event.actor?.email ?? "System"} · {formatDate(event.createdAt)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state compact">No audit events yet.</div>
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function DiffRow({
  label,
  changed,
  before,
  after,
}: {
  label: string;
  changed: boolean;
  before: string;
  after: string;
}) {
  return (
    <div className={`diff-row ${changed ? "changed" : "unchanged"}`}>
      <span className="diff-label">{label}</span>
      <span className="diff-before">{before}</span>
      <span className="diff-arrow">→</span>
      <span className="diff-after">{after}</span>
      <span className="diff-state">{changed ? "changed" : "same"}</span>
    </div>
  );
}

async function apiRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { message?: string | string[] }
      | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(", ")
      : body?.message;
    throw new Error(message ?? `API returned ${response.status}`);
  }

  return (await response.json()) as T;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected request error";
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function parseValue(value: string, type: ConfigKeyType) {
  if (type === "number") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error("Number value is invalid");
    return parsed;
  }
  if (type === "boolean") {
    if (value !== "true" && value !== "false") {
      throw new Error("Boolean value must be true or false");
    }
    return value === "true";
  }
  if (type === "json") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      throw new Error("JSON value is invalid");
    }
  }
  return value;
}

function valuePlaceholder(type: ConfigKeyType): string {
  if (type === "boolean") return "Use the switch";
  if (type === "json") return '{"enabled":true}';
  if (type === "number") return "180";
  return "value";
}

function typeIcon(type: ConfigKeyType): string {
  if (type === "number") return "#";
  if (type === "boolean") return "✓";
  if (type === "json") return "{}";
  return "Aa";
}

function statusLabel(
  status: ConfigRevisionStatus | null,
  selected: ConfigEntry | null,
): string {
  if (!selected) return "new draft";
  if (status) return status.replaceAll("_", " ");
  return selected.isPublished ? "published" : "no active draft";
}

function statusClass(status: ConfigRevisionStatus | null): string {
  if (status === "PUBLISHED") return "published";
  if (status === "APPROVED") return "approved";
  if (status === "PENDING_APPROVAL") return "pending";
  if (status === "REJECTED") return "rejected";
  if (status === "ARCHIVED") return "archived";
  return "draft";
}

function workflowMessage(
  status: ConfigRevisionStatus | null,
  selected: ConfigEntry | null,
  role: WorkspaceSummary["role"],
): string {
  if (!selected) {
    return "A new key starts as a draft and is not visible to the runtime endpoint until it is approved and published.";
  }
  if (status === "DRAFT") {
    return "This version is safe to edit. Saving changes does not affect the currently published runtime value.";
  }
  if (status === "PENDING_APPROVAL") {
    return ["owner", "admin", "approver"].includes(role)
      ? "The draft is waiting for review. Approve it or reject it before anything can be published."
      : "The draft is locked while it waits for a reviewer.";
  }
  if (status === "APPROVED") {
    return ["owner", "admin"].includes(role)
      ? "Review is complete. Publishing will atomically replace the runtime value and archive the previous version."
      : "The change is approved and is waiting for an owner or admin to publish it.";
  }
  return "The published value stays unchanged until somebody starts a new draft.";
}

function auditLabel(action: string, metadata: unknown): string {
  if (action === "DRAFT_CREATED" && rollbackSourceVersion(metadata) !== null) {
    return `Rollback draft created from v${rollbackSourceVersion(metadata)}`;
  }

  return action
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function rollbackSourceVersion(metadata: unknown): number | null {
  if (typeof metadata !== "object" || metadata === null) return null;
  const record = metadata as Record<string, unknown>;
  return record.source === "rollback" && typeof record.sourceVersion === "number"
    ? record.sourceVersion
    : null;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("uk-UA", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
