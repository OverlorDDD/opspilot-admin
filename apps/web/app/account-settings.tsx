"use client";

import { FormEvent, useState } from "react";
import type { AuthResponse, UserSummary } from "@opspilot/contracts";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export function AccountSettings({
  user,
  onSaved,
  onClose,
}: {
  user: UserSummary;
  onSaved: (user: UserSummary) => void;
  onClose: () => void;
}) {
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ firstName, lastName }),
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

      onSaved((body as AuthResponse).user);
      setSuccess(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update profile",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel settings-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">ACCOUNT SETTINGS</p>
          <h3>Personal profile</h3>
        </div>
        <button className="close-button" type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <form className="settings-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Email</span>
          <input value={user.email} disabled readOnly />
        </label>

        <div className="settings-name-grid">
          <label className="field">
            <span>First name</span>
            <input
              required
              maxLength={80}
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              autoComplete="given-name"
            />
          </label>
          <label className="field">
            <span>Last name</span>
            <input
              maxLength={80}
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              autoComplete="family-name"
            />
          </label>
        </div>

        <div className="settings-footer">
          <div>
            {success && <span className="success-message">Profile saved.</span>}
            {error && <span className="settings-error">{error}</span>}
          </div>
          <button className="primary-button" disabled={saving} type="submit">
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>
    </section>
  );
}
