"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RuntimeConfigResponse } from "@opspilot/contracts";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
const INITIAL_TASKS = [
  { id: 1, title: "Review delayed shipment #4182", status: "In progress" },
  { id: 2, title: "Confirm warehouse inventory", status: "Queued" },
  { id: 3, title: "Call carrier about route 12", status: "Queued" },
];
const SYNC_FAILURES_BEFORE_SUCCESS = 3;

type DemoTask = (typeof INITIAL_TASKS)[number];

type SyncAttempt = {
  number: number;
  result: "failed" | "success";
};

export function DemoClient() {
  const [runtime, setRuntime] = useState<RuntimeConfigResponse | null>(null);
  const [tasks, setTasks] = useState<DemoTask[]>(INITIAL_TASKS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [digestMessage, setDigestMessage] = useState<string | null>(null);
  const [syncAttempts, setSyncAttempts] = useState<SyncAttempt[]>([]);
  const [syncRunning, setSyncRunning] = useState(false);

  const loadRuntime = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_URL}/configs/runtime?environment=staging`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as RuntimeConfigResponse & {
        message?: string | string[];
      };

      if (!response.ok) {
        const message = Array.isArray(body.message)
          ? body.message.join(", ")
          : body.message;
        throw new Error(message || `Runtime API returned ${response.status}`);
      }

      setRuntime(body);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load runtime configuration",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRuntime();
  }, [loadRuntime]);

  const config = runtime?.values ?? {};
  const maxTasks = numberValue(config["limits.maxTasksPerUser"], 25);
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
  const taskLimitReached = tasks.length >= maxTasks;

  const capacityPercent = useMemo(() => {
    if (maxTasks <= 0) return 100;
    return Math.min(100, Math.round((tasks.length / maxTasks) * 100));
  }, [tasks.length, maxTasks]);

  function createTask(): void {
    if (maintenanceMode || taskLimitReached) return;

    const id = Math.max(0, ...tasks.map((task) => task.id)) + 1;
    setTasks((current) => [
      ...current,
      {
        id,
        title: `Investigate operations alert #${4200 + id}`,
        status: "Queued",
      },
    ]);
  }

  function sendDigest(): void {
    if (maintenanceMode || !weeklyDigest) return;
    setDigestMessage(
      `Digest queued for ${tasks.length} active tasks at ${new Date().toLocaleTimeString()}.`,
    );
  }

  async function runCarrierSync(): Promise<void> {
    if (maintenanceMode || syncRunning) return;

    setSyncRunning(true);
    setSyncAttempts([]);

    const totalAttemptsAllowed = 1 + maxRetries;
    const attempts: SyncAttempt[] = [];

    for (let attempt = 1; attempt <= totalAttemptsAllowed; attempt += 1) {
      await sleep(260);
      const succeeds = attempt > SYNC_FAILURES_BEFORE_SUCCESS;
      attempts.push({ number: attempt, result: succeeds ? "success" : "failed" });
      setSyncAttempts([...attempts]);
      if (succeeds) break;
    }

    setSyncRunning(false);
  }

  const syncSucceeded = syncAttempts.some((attempt) => attempt.result === "success");
  const syncFinishedWithoutSuccess =
    syncAttempts.length > 0 && !syncRunning && !syncSucceeded;

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
            <span>Monitor daily work and carrier integrations.</span>
          </div>
          <div className="dispatch-header-actions">
            <div className={`dispatch-runtime-pill ${runtime?.cache.status?.toLowerCase() ?? "loading"}`}>
              <span />
              Runtime {runtime?.cache.status ?? (loading ? "LOADING" : "—")}
            </div>
            <button disabled={loading} type="button" onClick={() => void loadRuntime()}>
              {loading ? "Refreshing…" : "Refresh config"}
            </button>
          </div>
        </header>

        {maintenanceMode && (
          <div className="dispatch-maintenance" role="status">
            <div>
              <strong>Scheduled maintenance is active</strong>
              <span>This product is now read-only. Create, send and sync actions are disabled.</span>
            </div>
            <span>READ ONLY</span>
          </div>
        )}

        {error && <div className="dispatch-error" role="alert">Runtime API error: {error}</div>}

        <section className="dispatch-kpis">
          <article>
            <span>Active work</span>
            <strong>{tasks.length}</strong>
            <small>of {maxTasks} allowed</small>
          </article>
          <article>
            <span>Weekly digest</span>
            <strong>{weeklyDigest ? "ON" : "OFF"}</strong>
            <small>{weeklyDigest ? "Monday · 09:00" : "Feature disabled"}</small>
          </article>
          <article>
            <span>Carrier retries</span>
            <strong>{maxRetries}</strong>
            <small>after first failed request</small>
          </article>
          <article>
            <span>Service state</span>
            <strong>{maintenanceMode ? "PAUSED" : "LIVE"}</strong>
            <small>{maintenanceMode ? "Writes disabled" : "All systems operational"}</small>
          </article>
        </section>

        <section className="dispatch-layout">
          <article className="dispatch-card dispatch-work-card">
            <div className="dispatch-card-heading">
              <div>
                <p>WORK QUEUE</p>
                <h2>Today&apos;s operations</h2>
              </div>
              <button
                className="dispatch-primary-action"
                disabled={maintenanceMode || taskLimitReached}
                type="button"
                onClick={createTask}
              >
                + New task
              </button>
            </div>

            <div className="dispatch-capacity">
              <div><span>Capacity used</span><strong>{tasks.length} / {maxTasks}</strong></div>
              <div><span style={{ width: `${capacityPercent}%` }} /></div>
            </div>

            {taskLimitReached && !maintenanceMode && (
              <div className="dispatch-inline-warning">
                Task creation is blocked by <code>limits.maxTasksPerUser = {maxTasks}</code>.
              </div>
            )}

            <div className="dispatch-task-list">
              {tasks.slice(-6).reverse().map((task) => (
                <div className="dispatch-task" key={task.id}>
                  <span className="dispatch-check">✓</span>
                  <div><strong>{task.title}</strong><small>Task #{task.id} · Operations</small></div>
                  <span className="dispatch-task-status">{task.status}</span>
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
                The report action exists only when the published feature flag is enabled.
              </p>
              <button
                className="dispatch-secondary-action"
                disabled={maintenanceMode || !weeklyDigest}
                type="button"
                onClick={sendDigest}
              >
                {weeklyDigest ? "Send digest now" : "Digest unavailable"}
              </button>
              {digestMessage && weeklyDigest && <div className="dispatch-success">{digestMessage}</div>}
            </article>

            <article className="dispatch-card">
              <div className="dispatch-card-heading compact">
                <div><p>INTEGRATION LAB</p><h2>Carrier sync</h2></div>
                <span className="dispatch-retry-count">{maxRetries} retries</span>
              </div>
              <p className="dispatch-copy">
                This simulated carrier fails its first {SYNC_FAILURES_BEFORE_SUCCESS} requests. The runtime retry limit decides whether the sync eventually succeeds.
              </p>
              <button
                className="dispatch-secondary-action"
                disabled={maintenanceMode || syncRunning}
                type="button"
                onClick={() => void runCarrierSync()}
              >
                {syncRunning ? "Syncing…" : "Run carrier sync"}
              </button>

              <div className="dispatch-attempts">
                {syncAttempts.map((attempt) => (
                  <div className={attempt.result} key={attempt.number}>
                    <span>Attempt {attempt.number}</span>
                    <strong>{attempt.result === "success" ? "200 OK" : "503 FAILED"}</strong>
                  </div>
                ))}
                {syncSucceeded && <p className="dispatch-success">Carrier sync completed successfully.</p>}
                {syncFinishedWithoutSuccess && (
                  <p className="dispatch-failure">
                    Sync stopped. Increase <code>limits.maxRetries</code> and publish the new config to allow more attempts.
                  </p>
                )}
              </div>
            </article>
          </div>
        </section>

        <footer className="dispatch-footer">
          <span>Flowline Dispatch · demo consumer</span>
          <span>
            Config generated {runtime ? new Date(runtime.generatedAt).toLocaleTimeString() : "—"}
          </span>
        </footer>
      </section>
    </main>
  );
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
