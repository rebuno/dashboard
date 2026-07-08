"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStep, grantApproval, denyApproval, type Approval, type Step } from "@/lib/api";
import { getApproverName, setApproverName } from "@/lib/storage";
import JsonBlock from "@/components/JsonBlock";

export default function ApprovalCard({ approval, onDecided }: { approval: Approval; onDecided: () => void }) {
  const [step, setStep] = useState<Step | null>(null);
  const [name, setName] = useState("");
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState<"grant" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(getApproverName());
    getStep(approval.execution_id, approval.step_id)
      .then(setStep)
      .catch(() => setStep(null));
  }, [approval.execution_id, approval.step_id]);

  const msRemaining = new Date(approval.timeout_at).getTime() - Date.now();
  const minutesRemaining = Math.round(msRemaining / 60000);
  const trimmedName = name.trim();

  async function decide(action: "grant" | "deny") {
    setError(null);
    setBusy(action);
    setApproverName(trimmedName);
    try {
      if (action === "grant") {
        await grantApproval(approval.id, trimmedName, rationale || undefined);
      } else {
        await denyApproval(approval.id, trimmedName, rationale || undefined);
      }
      onDecided();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${action}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="border border-gray-200 rounded-md p-4 space-y-2 bg-white">
      <div className="flex items-center justify-between">
        <Link href={`/executions/${approval.execution_id}`} className="text-xs text-blue-600 hover:underline">
          {approval.execution_id}
        </Link>
        <span className="text-xs text-gray-400">
          {minutesRemaining <= 0 ? "Expired" : `${minutesRemaining}m until timeout`}
        </span>
      </div>
      <div className="text-sm font-medium">{step ? `${step.kind}: ${step.target}` : `step ${approval.step_id}`}</div>
      {step && <JsonBlock label="Args" value={step.args} />}
      {approval.message && <p className="text-sm text-gray-600">{approval.message}</p>}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Your name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Rationale (optional)</label>
          <input
            type="text"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => decide("grant")}
          disabled={!trimmedName || busy !== null}
          className="flex-1 bg-green-600 text-white rounded px-3 py-1.5 text-sm hover:bg-green-700 disabled:opacity-50"
        >
          {busy === "grant" ? "Granting…" : "Grant"}
        </button>
        <button
          onClick={() => decide("deny")}
          disabled={!trimmedName || busy !== null}
          className="flex-1 bg-red-600 text-white rounded px-3 py-1.5 text-sm hover:bg-red-700 disabled:opacity-50"
        >
          {busy === "deny" ? "Denying…" : "Deny"}
        </button>
      </div>
    </div>
  );
}
