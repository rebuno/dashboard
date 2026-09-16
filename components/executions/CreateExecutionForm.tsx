"use client";

import { useState } from "react";
import { createExecution } from "@/lib/api";

export default function CreateExecutionForm({
  onCreated,
}: {
  onCreated: () => void;
}) {
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
      setError(
        err instanceof Error ? err.message : "Failed to create execution",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-b border-line bg-surface">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="group flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded border border-line-strong text-base font-normal text-ink-muted group-hover:border-ink-faint">
          {expanded ? "−" : "+"}
        </span>
        New execution
      </button>
      {expanded && (
        <form onSubmit={handleSubmit} className="space-y-3 px-4 pb-4">
          <div>
            <label
              htmlFor="new-execution-agent"
              className="mb-1.5 block text-xs font-medium text-ink-muted"
            >
              Agent ID
            </label>
            <input
              id="new-execution-agent"
              type="text"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              required
              className="field-control w-full px-2.5 py-1.5 text-sm"
              placeholder="e.g. researcher"
            />
          </div>
          <div>
            <label
              htmlFor="new-execution-input"
              className="mb-1.5 block text-xs font-medium text-ink-muted"
            >
              Input (JSON)
            </label>
            <textarea
              id="new-execution-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={3}
              className="field-control w-full px-2.5 py-1.5 font-mono text-xs leading-relaxed"
            />
          </div>
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="button-primary w-full"
          >
            {loading ? "Creating…" : "Create Execution"}
          </button>
        </form>
      )}
    </div>
  );
}
