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
    <form
      onSubmit={handleSubmit}
      className="border border-gray-200 rounded-md p-4 bg-white space-y-3 dark:border-gray-800 dark:bg-gray-900"
    >
      <h2 className="text-sm font-medium">Register Agent</h2>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1 dark:text-gray-400">
            ID
          </label>
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1 dark:text-gray-400">
            Webhook URL
          </label>
          <input
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500"
            placeholder="http://localhost:5000/webhook"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1 dark:text-gray-400">
            Secret
          </label>
          <input
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            required
            type="password"
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          />
        </div>
      </div>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white rounded px-3 py-1.5 text-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Registering…" : "Register"}
      </button>
    </form>
  );
}
