"use client";

import { FormEvent, useState } from "react";
import type { AuthResponse } from "@opspilot/contracts";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

type AuthMode = "login" | "register";

type AuthForm = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

const initialForm: AuthForm = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
};

export function AuthConsole({
  onAuthenticated,
}: {
  onAuthenticated: (session: AuthResponse) => void;
}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [form, setForm] = useState<AuthForm>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRegistering = mode === "register";

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          isRegistering
            ? form
            : { email: form.email, password: form.password },
        ),
      });

      const body = (await response.json().catch(() => null)) as
        | AuthResponse
        | { message?: string | string[] }
        | null;

      if (!response.ok) {
        const rawMessage =
          body && "message" in body ? body.message : undefined;
        const message = Array.isArray(rawMessage)
          ? rawMessage.join(", ")
          : rawMessage;
        throw new Error(message ?? `API returned ${response.status}`);
      }

      onAuthenticated(body as AuthResponse);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not complete authentication",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(nextMode: AuthMode): void {
    setMode(nextMode);
    setShowPassword(false);
    setError(null);
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark">G</div>
          <div>
            <p className="eyebrow accent">OPSPILOT ADMIN</p>
            <h1>Flowline operations workspace</h1>
          </div>
        </div>

        <div className="auth-heading">
          <p className="eyebrow">SECURE ACCESS</p>
          <h2>{isRegistering ? "Create your workspace account" : "Welcome back"}</h2>
          <p>
            {isRegistering
              ? "Start managing service parameters safely."
              : "Sign in to manage Flowline service behavior."}
          </p>
        </div>

        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegistering && (
            <div className="auth-name-grid">
              <label className="field">
                <span>First name</span>
                <input
                  required
                  maxLength={80}
                  value={form.firstName}
                  onChange={(event) =>
                    setForm({ ...form, firstName: event.target.value })
                  }
                  autoComplete="given-name"
                />
              </label>
              <label className="field">
                <span>Last name</span>
                <input
                  maxLength={80}
                  value={form.lastName}
                  onChange={(event) =>
                    setForm({ ...form, lastName: event.target.value })
                  }
                  autoComplete="family-name"
                />
              </label>
            </div>
          )}

          <label className="field">
            <span>Email</span>
            <input
              required
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              autoComplete="email"
            />
          </label>

          <label className="field">
            <span>Password</span>
            <div className="password-control">
              <input
                required
                minLength={8}
                maxLength={128}
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                autoComplete={isRegistering ? "new-password" : "current-password"}
              />
              <button
                className="password-toggle"
                type="button"
                aria-pressed={showPassword}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <button className="primary-button auth-submit" disabled={submitting} type="submit">
            {submitting
              ? "Please wait…"
              : isRegistering
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <div className="auth-switch">
          <span>
            {isRegistering ? "Already have an account?" : "New to OpsPilot?"}
          </span>
          <button
            className="link-button"
            type="button"
            onClick={() => switchMode(isRegistering ? "login" : "register")}
          >
            {isRegistering ? "Sign in" : "Create an account"}
          </button>
        </div>
      </section>
    </main>
  );
}
