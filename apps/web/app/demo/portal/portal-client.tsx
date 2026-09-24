"use client";

import { useCallback, useEffect, useState } from "react";
import type { RuntimeConfigResponse } from "@opspilot/contracts";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export function CustomerPortalDemo() {
  const [runtime, setRuntime] = useState<RuntimeConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [returnStarted, setReturnStarted] = useState(false);

  const loadRuntime = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_URL}/demo/portal/runtime`,
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
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRuntime();

    const interval = window.setInterval(() => {
      void loadRuntime();
    }, 5_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadRuntime();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadRuntime]);

  const values = runtime?.values ?? {};
  const returnsEnabled = booleanValue(values["portal.selfServiceReturns"], true);
  const maintenanceMode = booleanValue(values["portal.maintenanceMode"], false);
  const maxOpenTickets = Math.max(
    0,
    Math.floor(numberValue(values["portal.maxOpenTickets"], 5)),
  );
  const currentOpenTickets = 4;
  const ticketLimitReached = currentOpenTickets >= maxOpenTickets;

  return (
    <main className="portal-demo">
      <header className="portal-header">
        <a href="/demo/portal" className="portal-logo">
          <span>F</span>
          <strong>Flowline</strong>
        </a>
        <nav>
          <a href="#orders">Orders</a>
          <a href="#returns">Returns</a>
          <a href="#support">Support</a>
        </nav>
        <div className="portal-actions">
          <a href="/demo">Dispatch demo</a>
          <a href="/">OpsPilot ↗</a>
          <button disabled={loading} type="button" onClick={() => void loadRuntime()}>
            {loading ? "Refreshing…" : "Refresh policy"}
          </button>
        </div>
      </header>

      {maintenanceMode && (
        <section className="portal-maintenance">
          <strong>Customer Portal is in maintenance mode</strong>
          <span>Customers can view their account, but self-service actions are temporarily disabled.</span>
        </section>
      )}

      {error && <div className="portal-error">{error}</div>}

      <section className="portal-hero">
        <div>
          <p>CUSTOMER PORTAL</p>
          <h1>Everything about your deliveries, in one place.</h1>
          <span>
            This is a second independent product controlled by the same OpsPilot workspace.
          </span>
        </div>
        <div className="portal-policy-card">
          <small>LIVE POLICY</small>
          <strong>
            {runtime
              ? `${runtime.environment.toUpperCase()} · ${runtime.cache.status}`
              : "—"}
          </strong>
          <span>{runtime?.project.name ?? "Loading configuration…"}</span>
        </div>
      </section>

      <section className="portal-grid">
        <article className="portal-card" id="orders">
          <span className="portal-icon">PKG</span>
          <small>LATEST ORDER</small>
          <h2>Shipment #FL-28491</h2>
          <p>Arriving tomorrow · Route 12 · 2 packages</p>
          <div className="portal-progress"><span /></div>
          <strong className="portal-status">In transit</strong>
        </article>

        <article className="portal-card" id="returns">
          <span className="portal-icon">RET</span>
          <small>SELF-SERVICE RETURNS</small>
          <h2>{returnsEnabled ? "Return an item yourself" : "Returns require support"}</h2>
          <p>
            {returnsEnabled
              ? "OpsPilot currently exposes the self-service return workflow to customers."
              : "OpsPilot disabled this feature. Customers are redirected to support instead."}
          </p>
          <button
            className="portal-primary"
            disabled={maintenanceMode || !returnsEnabled}
            type="button"
            onClick={() => setReturnStarted(true)}
          >
            {returnsEnabled ? "Start a return" : "Self-service unavailable"}
          </button>
          {returnStarted && returnsEnabled && !maintenanceMode && (
            <div className="portal-success">
              Return workflow opened. No new frontend deployment was required.
            </div>
          )}
        </article>

        <article className="portal-card" id="support">
          <span className="portal-icon">SUP</span>
          <small>SUPPORT</small>
          <h2>{currentOpenTickets} open tickets</h2>
          <p>
            OpsPilot policy allows up to <strong>{maxOpenTickets}</strong> open tickets per customer.
          </p>
          <button
            className="portal-secondary"
            disabled={maintenanceMode || ticketLimitReached}
            type="button"
          >
            {ticketLimitReached ? "Ticket limit reached" : "Create support ticket"}
          </button>
          {ticketLimitReached && (
            <div className="portal-warning">
              New ticket creation is blocked by <code>portal.maxOpenTickets = {maxOpenTickets}</code>.
            </div>
          )}
        </article>
      </section>

      <section className="portal-explainer">
        <div>
          <small>WHY A CENTRAL CONTROL PLANE?</small>
          <h2>Two products. One governed configuration workflow.</h2>
        </div>
        <p>
          Flowline Dispatch and Flowline Customer Portal have different UIs and
          different runtime policies, but they share OpsPilot&apos;s RBAC, approvals,
          audit trail, version history and rollback instead of rebuilding those
          systems twice.
        </p>
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown request error";
}
