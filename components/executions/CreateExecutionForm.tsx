"use client";

import { useState } from "react";
import { createExecution } from "@/lib/api";

export default function CreateExecutionForm({ onCreated }: { onCreated: () => void }) {
  const [agentId, setAgentId] = useState("");
  const [input, setInput] = useState("{}");
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    let parsed: unknown;
    try {
      parsed = JSON.parse(input);
    } catch {
      setError("Invalid JSON input");
      return;
    }
    setLoading(true);
    try {
      await createExecution(agentId, parsed);
      setExpanded(false);
      setAgentId("");
      setInput("{}");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create execution");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-b border-gray-200">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        {expanded ? "− New Execution" : "+ New Execution"}
      </button>
      {expanded && (
        <form onSubmit={handleSubmit} className="px-4 pb-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Agent ID</label>
            <input
              type="text"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              required
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. researcher"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Input (JSON)</label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded px-3 py-1.5 text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create Execution"}
          </button>
        </form>
      )}
    </div>
  );
}
