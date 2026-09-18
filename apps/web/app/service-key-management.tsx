"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type {
  CreateServiceApiKeyResponse,
  EnvironmentName,
  ServiceApiKeyListResponse,
  ServiceApiKeySummary,
} from "@opspilot/contracts";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export function ServiceKeyManagement({
  projectId,
  projectName,
  environment,
  onClose,
}: {
  projectId: string;
  projectName: string;
  environment: EnvironmentName;
  onClose: () => void;
}) {
  const [items, setItems] = useState<ServiceApiKeySummary[]>([]);
  const [name, setName] = useState("Node consumer");
  const [secret, setSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const baseUrl =
    typeof window === "undefined" ? "https://your-opspilot.example" : window.location.origin;

  const snippet = useMemo(
    () => `const { OpsPilotClient } = require("@opspilot/node");

const opspilot = new OpsPilotClient({
  baseUrl: "${baseUrl}",
  apiKey: process.env.OPSPILOT_API_KEY,
  refreshIntervalMs: 60_000,
});

await opspilot.refresh();

const maintenance = opspilot.get("service.maintenanceMode", false);
`,
    [baseUrl],
  );

  const loadKeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest<ServiceApiKeyListResponse>(
        `${API_URL}/integrations/service-keys?projectId=${encodeURIComponent(projectId)}&environment=${environment}`,
      );
      setItems(response.items);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [environment, projectId]);

  useEffect(() => {
    setSecret(null);
    void loadKeys();
  }, [loadKeys]);

  async function createKey(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSecret(null);

    try {
      const response = await apiRequest<CreateServiceApiKeyResponse>(
        `${API_URL}/integrations/service-keys`,
        {
          method: "POST",
          body: JSON.stringify({
            projectId,
            environment,
            name,
          }),
        },
      );
      setSecret(response.secret);
      setName("Node consumer");
      await loadKeys();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function revokeKey(id: string): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      await apiRequest<ServiceApiKeySummary>(
        `${API_URL}/integrations/service-keys/${id}/revoke`,
        { method: "POST" },
      );
      await loadKeys();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function copy(value: string): Promise<void> {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <section className="panel integration-panel">
      <div className="panel-heading team-heading">
        <div>
          <p className="eyebrow">CONSUMER INTEGRATION</p>
          <h3>{projectName} · {environment}</h3>
          <p className="team-intro">
            Service keys authenticate backend consumers. Each key is bound to this
            project and environment and has only the <code>runtime:read</code> scope.
          </p>
        </div>
        <button className="close-button" type="button" onClick={onClose}>
          Close
        </button>
      </div>

      {error && <div className="settings-error">{error}</div>}

      <div className="integration-grid">
        <form className="integration-create" onSubmit={createKey}>
          <label className="field">
            <span>Key name</span>
            <input
              required
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Production Node service"
            />
          </label>
          <button className="primary-button" disabled={saving} type="submit">
            {saving ? "Creating…" : "Create service key"}
          </button>

          {secret && (
            <div className="secret-once">
              <strong>Copy this secret now — it will not be shown again.</strong>
              <code>{secret}</code>
              <button
                className="secondary-button"
                type="button"
                onClick={() => void copy(secret)}
              >
                {copied ? "Copied" : "Copy secret"}
              </button>
            </div>
          )}
        </form>

        <div className="integration-snippet">
          <div>
            <strong>Node.js SDK example</strong>
            <span>
              Keep the API key in a server-side environment variable, never in React.
            </span>
          </div>
          <pre><code>{snippet}</code></pre>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void copy(snippet)}
          >
            Copy example
          </button>
        </div>
      </div>

      <div className="integration-list">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">SERVICE KEYS</p>
            <h3>Issued credentials</h3>
          </div>
        </div>

        {loading ? (
          <div className="empty-state compact">Loading service keys…</div>
        ) : items.length ? (
          items.map((item) => (
            <article className="integration-key-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span>{item.keyPrefix}… · {item.scope}</span>
              </div>
              <div>
                <span className={`status-badge ${item.revokedAt ? "archived" : "published"}`}>
                  {item.revokedAt ? "revoked" : "active"}
                </span>
                <small>
                  Last used: {item.lastUsedAt
                    ? new Date(item.lastUsedAt).toLocaleString()
                    : "never"}
                </small>
              </div>
              <button
                className="secondary-button"
                disabled={saving || Boolean(item.revokedAt)}
                type="button"
                onClick={() => void revokeKey(item.id)}
              >
                {item.revokedAt ? "Revoked" : "Revoke"}
              </button>
            </article>
          ))
        ) : (
          <div className="empty-state compact">No service keys for this project/environment.</div>
        )}
      </div>
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

  const body = (await response.json().catch(() => ({}))) as T & {
    message?: string | string[];
  };

  if (!response.ok) {
    const message = Array.isArray(body.message)
      ? body.message.join(", ")
      : body.message;
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return body;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown request error";
}
