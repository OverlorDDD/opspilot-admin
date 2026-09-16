"use client";

import { useEffect, useState } from "react";
import type { AuthResponse, UserSummary } from "@opspilot/contracts";
import { AuthConsole } from "./auth-console";
import { ConfigConsole } from "./config-console";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export function AuthGate() {
  const [session, setSession] = useState<AuthResponse | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    async function loadSession(): Promise<void> {
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          credentials: "include",
          cache: "no-store",
        });
        if (response.ok) {
          const body = (await response.json()) as AuthResponse;
          setSession(body);
        }
      } catch {
        setSession(null);
      } finally {
        setCheckingSession(false);
      }
    }

    void loadSession();
  }, []);

  if (checkingSession) {
    return (
      <main className="auth-shell">
        <div className="auth-loading">Checking your workspace session…</div>
      </main>
    );
  }

  if (!session) {
    return <AuthConsole onAuthenticated={setSession} />;
  }

  async function handleLogout(): Promise<void> {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    setSession(null);
  }

  return (
    <ConfigConsole
      user={session.user}
      workspace={session.workspace}
      onLogout={handleLogout}
      onUserUpdated={(user: UserSummary) => setSession({ ...session, user })}
    />
  );
}
