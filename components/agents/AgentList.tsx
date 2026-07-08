"use client";

import { useState } from "react";
import { deleteAgent, loadPolicy, type Agent } from "@/lib/api";

export default function AgentList({ agents, onChanged }: { agents: Agent[]; onChanged: () => void }) {
  const [policyDrafts, setPolicyDrafts] = useState<Record<string, string>>({});
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});

  function setBusy(id: string, busy: boolean) {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleDelete(id: string) {
    setBusy(id, true);
    try {
      await deleteAgent(id);
      onChanged();
    } catch (e) {
      setErrors((prev) => ({ ...prev, [id]: e instanceof Error ? e.message : "Failed to delete" }));
    } finally {
      setBusy(id, false);
    }
  }

  function handlePolicyKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>, id: string, current: string) {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart, selectionEnd } = el;
    const next = current.slice(0, selectionStart) + "  " + current.slice(selectionEnd);
    setPolicyDrafts((prev) => ({ ...prev, [id]: next }));
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = selectionStart + 2;
    });
  }

  async function handleLoadPolicy(id: string, currentBundle: string) {
    const bundle = policyDrafts[id] ?? currentBundle;
    setBusy(id, true);
    try {
      await loadPolicy(id, bundle);
      setErrors((prev) => ({ ...prev, [id]: "" }));
    } catch (e) {
      setErrors((prev) => ({ ...prev, [id]: e instanceof Error ? e.message : "Failed to load policy" }));
    } finally {
      setBusy(id, false);
    }
  }

  if (agents.length === 0) {
    return <p className="text-sm text-gray-400">No agents registered</p>;
  }

  return (
    <div className="space-y-3">
      {agents.map((agent) => (
        <div key={agent.ID} className="border border-gray-200 rounded-md p-4 bg-white space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{agent.ID}</div>
              <div className="text-xs text-gray-500">{agent.WebhookURL}</div>
              <div className="text-xs text-gray-400">registered {new Date(agent.RegisteredAt).toLocaleString()}</div>
            </div>
            <button
              onClick={() => handleDelete(agent.ID)}
              disabled={busyIds.has(agent.ID)}
              className="border border-red-300 text-red-600 rounded px-3 py-1 text-xs hover:bg-red-50 disabled:opacity-40"
            >
              Delete
            </button>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Policy bundle (YAML)</label>
            <textarea
              value={policyDrafts[agent.ID] ?? agent.PolicyBundle ?? ""}
              onChange={(e) => setPolicyDrafts((prev) => ({ ...prev, [agent.ID]: e.target.value }))}
              onKeyDown={(e) => handlePolicyKeyDown(e, agent.ID, policyDrafts[agent.ID] ?? agent.PolicyBundle ?? "")}
              rows={4}
              spellCheck={false}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs font-mono"
              placeholder={"default_action: allow\nrules: []"}
            />
            <button
              onClick={() => handleLoadPolicy(agent.ID, agent.PolicyBundle ?? "")}
              disabled={busyIds.has(agent.ID)}
              className="mt-2 border border-gray-300 rounded px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-40"
            >
              Load Policy
            </button>
            {errors[agent.ID] && <p className="text-xs text-red-600 mt-1">{errors[agent.ID]}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
