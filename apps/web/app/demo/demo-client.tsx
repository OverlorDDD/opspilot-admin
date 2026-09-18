"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import type {
  CarrierSyncResponse,
  DigestQueueResponse,
  DispatchStateResponse,
  DispatchTask,
} from "@opspilot/contracts";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export function DemoClient() {
  const [state, setState] = useState<DispatchStateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [digestMessage, setDigestMessage] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<CarrierSyncResponse | null>(null);

  const loadState = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiRequest<DispatchStateResponse>(
        `${API_URL}/demo/dispatch`,
      );
      setState(response);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const runtime = state?.runtime ?? null;
  const tasks = state?.tasks ?? [];
  const events = state?.events ?? [];
  const config = runtime?.values ?? {};

  const maxTasks = Math.max(
    0,
    Math.floor(numberValue(config["limits.maxTasksPerUser"], 25)),
  );
  const maintenanceMode = booleanValue(
    config["service.maintenanceMode"],
    false,
  );
  const weeklyDigest = booleanValue(
    config["notifications.weeklyDigest"],
    true,
  );
  const maxRetries = Math.max(
    0,
    Math.floor(numberValue(config["limits.maxRetries"], 3)),
  );

  const activeTasks = useMemo(
    () => tasks.filter((task) => task.status !== "DONE"),
    [tasks],
  );
  const taskLimitReached = activeTasks.length >= maxTasks;

  const capacityPercent = useMemo(() => {
    if (maxTasks <= 0) return 100;
    return Math.min(
      100,
      Math.round((activeTasks.length / maxTasks) * 100),
    );
  }, [activeTasks.length, maxTasks]);

  async function createTask(): Promise<void> {
    setAction("create-task");
    setError(null);
    try {
      await apiRequest<DispatchTask>(`${API_URL}/demo/dispatch/tasks`, {
        method: "POST",
      });
      await loadState();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setAction(null);
    }
  }

  async function completeTask(taskId: string): Promise<void> {
    setAction(`complete-${taskId}`);
    setError(null);
    try {
      await apiRequest<DispatchTask>(
        `${API_URL}/demo/dispatch/tasks/${taskId}/complete`,
        { method: "PATCH" },
      );
      await loadState();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setAction(null);
    }
  }

  async function sendDigest(): Promise<void> {
    setAction("digest");
    setError(null);
    try {
      const response = await apiRequest<DigestQueueResponse>(
        `${API_URL}/demo/dispatch/digest`,
        { method: "POST" },
      );
      setDigestMessage(response.message);
      await loadState();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setAction(null);
    }
  }

  async function runCarrierSync(): Promise<void> {
    setAction("carrier-sync");
    setError(null);
    setSyncResult(null);
    try {
      const response = await apiRequest<CarrierSyncResponse>(
        `${API_URL}/demo/dispatch/carrier-sync`,
        { method: "POST" },
      );
      setSyncResult(response);
      await loadState();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setAction(null);
    }
  }

  return (
    <main className="dispatch-app">
      <aside className="dispatch-sidebar">
        <a className="dispatch-brand" href="/demo" aria-label="Flowline Dispatch home">
          <span className="dispatch-brand-mark">FD</span>
          <span>
            <strong>Flowline</strong>
            <small>Dispatch</small>
          </span>
        </a>

        <nav className="dispatch-nav" aria-label="Demo product navigation">
          <button className="active" type="button"><span>⌂</span> Overview</button>
          <button type="button"><span>✓</span> Work queue</button>
          <button type="button"><span>⇄</span> Integrations</button>
          <button type="button"><span>✉</span> Reports</button>
        </nav>

        <div className="dispatch-sidebar-bottom">
          <div className="dispatch-user">
            <span>AM</span>
            <div><strong>Alex Morgan</strong><small>Operations manager</small></div>
          </div>
          <a href="/">Open OpsPilot Admin ↗</a>
        </div>
      </aside>

      <section className="dispatch-main">
        <header className="dispatch-header">
          <div>
            <p>OPERATIONS WORKSPACE</p>
            <h1>Good afternoon, Alex.</h1>
            <span>Real demo data is persisted through NestJS and PostgreSQL.</span>
          </div>
          <div className="dispatch-header-actions">
            <div className={`dispatch-runtime-pill ${runtime?.cache.status?.toLowerCase() ?? "loading"}`}>
              <span />
              Runtime {runtime?.cache.status ?? (loading ? "LOADING" : "—")}
            </div>
            <button disabled={loading} type="button" onClick={() => void loadState()}>
              {loading ? "Refreshing…" : "Refresh config"}
            </button>
          </div>
        </header>

        <div className="dispatch-control-plane">
          <strong>Controlled by OpsPilot</strong>
          <span>
            These policies are read from the published runtime configuration and
            enforced again by the Dispatch backend. Reloading this page does not
            reset tasks or activity history.
          </span>
        </div>

        {maintenanceMode && (
          <div className="dispatch-maintenance" role="status">
            <div>
              <strong>Scheduled maintenance is active</strong>
              <span>
                Server-side write operations are blocked until OpsPilot publishes
                maintenance mode = false.
              </span>
            </div>
            <span>READ ONLY</span>
          </div>
        )}

        {error && (
          <div className="dispatch-error" role="alert">
            Action rejected by Dispatch API: {error}
          </div>
        )}

        <section className="dispatch-kpis">
          <article>
            <span>Active work</span>
            <strong>{activeTasks.length}</strong>
            <small>of {maxTasks} allowed by OpsPilot</small>
          </article>
          <article>
            <span>Weekly digest</span>
            <strong>{weeklyDigest ? "ON" : "OFF"}</strong>
            <small>{weeklyDigest ? "Server action enabled" : "Endpoint policy disabled"}</small>
          </article>
          <article>
            <span>Carrier retries</span>
            <strong>{maxRetries}</strong>
            <small>after the first failed request</small>
          </article>
          <article>
            <span>Service state</span>
            <strong>{maintenanceMode ? "PAUSED" : "LIVE"}</strong>
            <small>{maintenanceMode ? "Writes rejected by API" : "All writes available"}</small>
          </article>
        </section>

        <section className="dispatch-layout">
          <article className="dispatch-card dispatch-work-card">
            <div className="dispatch-card-heading">
              <div>
                <p>PERSISTENT WORK QUEUE</p>
                <h2>Today&apos;s operations</h2>
              </div>
              <button
                className="dispatch-primary-action"
                disabled={
                  maintenanceMode ||
                  taskLimitReached ||
                  action === "create-task"
                }
                type="button"
                onClick={() => void createTask()}
              >
                {action === "create-task" ? "Creating…" : "+ New task"}
              </button>
            </div>

            <div className="dispatch-capacity">
              <div>
                <span>Capacity used</span>
                <strong>{activeTasks.length} / {maxTasks}</strong>
              </div>
              <div><span style={{ width: `${capacityPercent}%` }} /></div>
            </div>

            {taskLimitReached && !maintenanceMode && (
              <div className="dispatch-inline-warning">
                The backend rejects new tasks because{" "}
                <code>limits.maxTasksPerUser = {maxTasks}</code>.
              </div>
            )}

            <div className="dispatch-task-list">
              {tasks.slice(-8).reverse().map((task) => (
                <div className={`dispatch-task ${task.status === "DONE" ? "done" : ""}`} key={task.id}>
                  <span className="dispatch-check">
                    {task.status === "DONE" ? "✓" : "•"}
                  </span>
                  <div>
                    <strong>{task.title}</strong>
                    <small>
                      Persisted task · {new Date(task.createdAt).toLocaleTimeString()}
                    </small>
                  </div>
                  <span className="dispatch-task-status">
                    {taskStatusLabel(task.status)}
                  </span>
                  {task.status !== "DONE" && (
                    <button
                      className="dispatch-task-action"
                      disabled={
                        maintenanceMode ||
                        action === `complete-${task.id}`
                      }
                      type="button"
                      onClick={() => void completeTask(task.id)}
                    >
                      {action === `complete-${task.id}` ? "Saving…" : "Complete"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </article>

          <div className="dispatch-right-column">
            <article className="dispatch-card">
              <div className="dispatch-card-heading compact">
                <div><p>NOTIFICATIONS</p><h2>Weekly digest</h2></div>
                <span className={`dispatch-feature-state ${weeklyDigest ? "on" : "off"}`}>
                  {weeklyDigest ? "Enabled" : "Disabled"}
                </span>
              </div>
              <p className="dispatch-copy">
                This is now a real backend action. When enabled, NestJS stores a
                persistent DIGEST_QUEUED event; when disabled, the API rejects it.
              </p>
              <button
                className="dispatch-secondary-action"
                disabled={
                  maintenanceMode ||
                  !weeklyDigest ||
                  action === "digest"
                }
                type="button"
                onClick={() => void sendDigest()}
              >
                {action === "digest"
                  ? "Queueing…"
                  : weeklyDigest
                    ? "Send digest now"
                    : "Digest unavailable"}
              </button>
              {digestMessage && weeklyDigest && (
                <div className="dispatch-success">{digestMessage}</div>
              )}
            </article>

            <article className="dispatch-card">
              <div className="dispatch-card-heading compact">
                <div><p>INTEGRATION LAB</p><h2>Carrier sync</h2></div>
                <span className="dispatch-retry-count">{maxRetries} retries</span>
              </div>
              <p className="dispatch-copy">
                The simulated carrier returns 503 for its first 3 attempts.
                OpsPilot controls how many retries the backend is allowed to make.
              </p>
              <button
                className="dispatch-secondary-action"
                disabled={maintenanceMode || action === "carrier-sync"}
                type="button"
                onClick={() => void runCarrierSync()}
              >
                {action === "carrier-sync" ? "Syncing…" : "Run carrier sync"}
              </button>

              <div className="dispatch-attempts">
                {syncResult?.attempts.map((attempt) => (
                  <div className={attempt.result} key={attempt.number}>
                    <span>Attempt {attempt.number}</span>
                    <strong>{attempt.result === "success" ? "200 OK" : "503 FAILED"}</strong>
                  </div>
                ))}
                {syncResult?.success && (
                  <p className="dispatch-success">
                    Carrier sync completed. The result is stored in PostgreSQL.
                  </p>
                )}
                {syncResult && !syncResult.success && (
                  <p className="dispatch-failure">
                    Sync stopped after the configured retry budget. Increase{" "}
                    <code>limits.maxRetries</code> in OpsPilot, approve and publish it,
                    then try again.
                  </p>
                )}
              </div>
            </article>

            <article className="dispatch-card dispatch-activity-card">
              <div className="dispatch-card-heading compact">
                <div><p>PERSISTENT ACTIVITY</p><h2>Backend event log</h2></div>
                <span className="dispatch-retry-count">{events.length} recent</span>
              </div>
              <div className="dispatch-activity-list">
                {events.length ? events.map((event) => (
                  <div key={event.id}>
                    <span>{eventTypeLabel(event.type)}</span>
                    <strong>{event.message}</strong>
                    <small>{new Date(event.createdAt).toLocaleString()}</small>
                  </div>
                )) : (
                  <p className="dispatch-copy">No demo events yet. Create a task, queue a digest or run sync.</p>
                )}
              </div>
            </article>
          </div>
        </section>

        <footer className="dispatch-footer">
          <span>Flowline Dispatch · persistent runtime-config consumer</span>
          <span>
            Config generated {runtime ? new Date(runtime.generatedAt).toLocaleTimeString() : "—"}
          </span>
        </footer>
      </section>
    </main>
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

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function taskStatusLabel(status: DispatchTask["status"]): string {
  if (status === "IN_PROGRESS") return "In progress";
  if (status === "DONE") return "Done";
  return "Queued";
}

function eventTypeLabel(type: string): string {
  return type
    .toLowerCase()
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown request error";
}
