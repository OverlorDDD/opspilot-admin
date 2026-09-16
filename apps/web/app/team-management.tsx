"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  WorkspaceRole,
  WorkspaceSummary,
  WorkspaceUserAccess,
  WorkspaceUsersResponse,
} from "@opspilot/contracts";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
const roles: WorkspaceRole[] = [
  "owner",
  "admin",
  "editor",
  "approver",
  "viewer",
];

const roleDescriptions: Record<WorkspaceRole, string> = {
  owner: "Full access, including role administration.",
  admin: "Operational administration and publishing.",
  editor: "Creates and edits drafts, then submits them.",
  approver: "Reviews drafts and can approve or reject them.",
  viewer: "Read-only access to the workspace.",
};

export function TeamManagement({
  currentUserId,
  workspace,
  onClose,
}: {
  currentUserId: string;
  workspace: WorkspaceSummary;
  onClose: () => void;
}) {
  const [data, setData] = useState<WorkspaceUsersResponse | null>(null);
  const [draftRoles, setDraftRoles] = useState<Record<string, WorkspaceRole>>({});
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest<WorkspaceUsersResponse>(
        `${API_URL}/workspaces/current/users`,
      );
      setData(response);
      setDraftRoles(
        Object.fromEntries(
          response.users.map((entry) => [entry.user.id, entry.role ?? "viewer"]),
        ),
      );
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const memberCount = useMemo(
    () => data?.users.filter((entry) => entry.isMember).length ?? 0,
    [data],
  );

  async function saveRole(entry: WorkspaceUserAccess): Promise<void> {
    const nextRole = draftRoles[entry.user.id] ?? "viewer";
    setSavingUserId(entry.user.id);
    setError(null);
    setSuccess(null);

    try {
      const updated = await apiRequest<WorkspaceUserAccess>(
        `${API_URL}/workspaces/current/users/${entry.user.id}/role`,
        {
          method: "PATCH",
          body: JSON.stringify({ role: nextRole }),
        },
      );

      setData((current) =>
        current
          ? {
              ...current,
              users: current.users.map((item) =>
                item.user.id === updated.user.id ? updated : item,
              ),
            }
          : current,
      );
      setDraftRoles((current) => ({
        ...current,
        [updated.user.id]: updated.role ?? "viewer",
      }));
      setSuccess(
        `${updated.user.email} now has the ${updated.role ?? "viewer"} role.`,
      );
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSavingUserId(null);
    }
  }

  function roleOptionDisabled(
    entry: WorkspaceUserAccess,
    role: WorkspaceRole,
  ): boolean {
    if (workspace.role === "owner") return false;

    // Admins can manage everyday roles, but owner/admin changes are reserved
    // for owners. This mirrors the backend rule instead of relying on UI only.
    if (entry.role === "owner" || entry.role === "admin") return true;
    return role === "owner" || role === "admin";
  }

  return (
    <section className="panel team-panel">
      <div className="panel-heading team-heading">
        <div>
          <p className="eyebrow">USER MANAGEMENT</p>
          <h3>Registered users & workspace roles</h3>
          <p className="team-intro">
            A user account and workspace access are separate things. Assigning a
            role creates or updates that user&apos;s membership in {workspace.name}.
            This portfolio demo intentionally shows all registered demo accounts;
            a multi-company SaaS would normally scope this list to the current
            organization and use invitations instead of exposing other tenants.
          </p>
        </div>
        <button className="close-button" type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="team-stats">
        <span>{data?.users.length ?? 0} registered accounts</span>
        <span>{memberCount} workspace members</span>
        <span>Your role: {workspace.role}</span>
      </div>

      {error && <div className="settings-error">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {loading ? (
        <div className="empty-state compact">Loading registered users…</div>
      ) : data?.users.length ? (
        <div className="team-list">
          {data.users.map((entry) => {
            const displayName = [entry.user.firstName, entry.user.lastName]
              .filter(Boolean)
              .join(" ");
            const draftRole = draftRoles[entry.user.id] ?? entry.role ?? "viewer";
            const isSelf = entry.user.id === currentUserId;
            const isAdminLocked =
              workspace.role === "admin" &&
              (entry.role === "owner" || entry.role === "admin");
            const roleEditingDisabled = isSelf || isAdminLocked;

            return (
              <article className="team-row" key={entry.user.id}>
                <div className="team-person">
                  <div className="team-avatar">
                    {entry.user.firstName.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <strong>
                      {displayName || entry.user.email}
                      {entry.user.id === currentUserId ? " (you)" : ""}
                    </strong>
                    <span>{entry.user.email}</span>
                    <small>
                      Registered {new Date(entry.user.createdAt).toLocaleDateString()}
                    </small>
                  </div>
                </div>

                <div className="membership-state">
                  <span className={`status-badge ${entry.isMember ? "published" : "archived"}`}>
                    {entry.isMember ? "member" : "not in workspace"}
                  </span>
                  {entry.joinedAt && (
                    <small>Joined {new Date(entry.joinedAt).toLocaleDateString()}</small>
                  )}
                </div>

                <div className="role-control">
                  <select
                    aria-label={`Role for ${entry.user.email}`}
                    disabled={roleEditingDisabled || savingUserId === entry.user.id}
                    value={draftRole}
                    onChange={(event) =>
                      setDraftRoles((current) => ({
                        ...current,
                        [entry.user.id]: event.target.value as WorkspaceRole,
                      }))
                    }
                  >
                    {roles.map((role) => (
                      <option
                        disabled={roleOptionDisabled(entry, role)}
                        key={role}
                        value={role}
                      >
                        {role}
                      </option>
                    ))}
                  </select>
                  <small>{roleDescriptions[draftRole]}</small>
                </div>

                <button
                  className="secondary-button"
                  disabled={roleEditingDisabled || savingUserId === entry.user.id}
                  type="button"
                  onClick={() => void saveRole(entry)}
                >
                  {savingUserId === entry.user.id
                    ? "Saving…"
                    : entry.isMember
                      ? "Save role"
                      : "Add to workspace"}
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state compact">No registered users found.</div>
      )}
    </section>
  );
}

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const body = (await response.json().catch(() => ({}))) as {
    message?: string | string[];
  };

  if (!response.ok) {
    const message = Array.isArray(body.message)
      ? body.message.join(", ")
      : body.message;
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return body as T;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown request error";
}
