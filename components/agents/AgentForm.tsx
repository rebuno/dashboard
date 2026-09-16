"use client";

import { useState } from "react";
import { registerAgent } from "@/lib/api";

export default function AgentForm({
  onRegistered,
}: {
  onRegistered: () => void;
}) {
  const [id, setId] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await registerAgent(id, webhookUrl, secret);
      setId("");
      setWebhookUrl("");
      setSecret("");
      onRegistered();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register agent");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="surface-card p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold">Register agent</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Connect a worker endpoint to make it available for executions.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label
            htmlFor="agent-id"
            className="mb-1.5 block text-xs font-medium text-ink-muted"
          >
            ID
          </label>
          <input
            id="agent-id"
            value={id}
            onChange={(e) => setId(e.target.value)}
            required
            className="field-control w-full px-2.5 py-1.5 text-sm"
            placeholder="researcher"
          />
        </div>
        <div>
          <label
            htmlFor="agent-webhook-url"
            className="mb-1.5 block text-xs font-medium text-ink-muted"
          >
            Webhook URL
          </label>
          <input
            id="agent-webhook-url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            required
            className="field-control w-full px-2.5 py-1.5 text-sm"
            placeholder="http://localhost:5000/webhook"
          />
        </div>
        <div>
          <label
            htmlFor="agent-secret"
            className="mb-1.5 block text-xs font-medium text-ink-muted"
          >
            Secret
          </label>
          <input
            id="agent-secret"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            required
            type="password"
            className="field-control w-full px-2.5 py-1.5 text-sm"
            placeholder="Webhook signing secret"
          />
        </div>
      </div>
      {error && (
        <p className="mt-3 text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <button type="submit" disabled={loading} className="button-primary">
          {loading ? "Registering…" : "Register agent"}
        </button>
      </div>
    </form>
  );
}
