"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { type ForkPoints, forkExecution, getForkPoints } from "@/lib/api";
import { selectRestoration } from "@/lib/fork";

export default function ForkForm({
  executionId,
  atSeq,
  onCancel,
}: {
  executionId: string;
  atSeq: number;
  onCancel: () => void;
}) {
  const router = useRouter();
  const id = useId();
  const [session, setSession] = useState("");
  const [bundle, setBundle] = useState("");
  const [points, setPoints] = useState<ForkPoints | null>(null);
  const [pointsError, setPointsError] = useState<string | null>(null);
  const [forking, setForking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getForkPoints(executionId).then(
      (p) => {
        if (!cancelled) setPoints(p);
      },
      (e) => {
        if (!cancelled)
          setPointsError(e instanceof Error ? e.message : "Request failed");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [executionId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setForking(true);
    setError(null);
    try {
      const fork = await forkExecution(executionId, {
        at_seq: atSeq,
        session: session.trim() || undefined,
        policy_bundle: bundle.trim() ? bundle : undefined,
      });
      router.push(`/executions/${fork.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fork");
      setForking(false);
    }
  }

  const restoration = points
    ? Object.entries(selectRestoration(points, atSeq))
    : [];

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 space-y-3 rounded-md border border-line bg-surface-muted p-3 text-xs"
    >
      <p className="text-ink-soft">
        The fork replays the steps recorded up to event {atSeq} and runs live
        after it. Live <code>at_most_once</code> steps wait for approval.
      </p>
      {!points && !pointsError && (
        <p className="text-ink-muted">Checking resource coverage…</p>
      )}
      {pointsError && (
        <p className="text-amber-800 dark:text-amber-300" role="alert">
          Resource coverage unavailable: {pointsError}
        </p>
      )}
      {restoration.length > 0 && (
        <div>
          <div className="mb-1.5 font-medium text-ink-muted">Resources</div>
          <ul className="space-y-1">
            {restoration.map(([key, sel]) => (
              <li key={key} className="flex flex-wrap gap-x-2">
                <code className="text-ink">{key}</code>
                {sel.covered ? (
                  <span className="text-ink-muted">
                    restores checkpoint <code>{sel.checkpoint_ref}</code>
                  </span>
                ) : (
                  <span className="text-amber-800 dark:text-amber-300">
                    {sel.checkpoint_ref ? (
                      <>
                        not covered, restores checkpoint{" "}
                        <code>{sel.checkpoint_ref}</code> from event{" "}
                        {sel.checkpoint_seq}
                      </>
                    ) : (
                      "not covered, starts from its initial state"
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {restoration.some(([, sel]) => !sel.covered) && (
            <p className="mt-1.5 text-ink-muted">
              Replayed results can describe changes missing from a resource that
              is not covered.
            </p>
          )}
        </div>
      )}
      <div>
        <label
          htmlFor={`${id}-session`}
          className="mb-1.5 block font-medium text-ink-muted"
        >
          Session (optional)
        </label>
        <input
          id={`${id}-session`}
          type="text"
          value={session}
          onChange={(e) => setSession(e.target.value)}
          className="field-control w-full px-2.5 py-1.5 text-sm"
          placeholder="A session with no executions"
        />
      </div>
      <details>
        <summary className="cursor-pointer font-medium text-ink-muted hover:text-ink">
          Policy override
        </summary>
        <label
          htmlFor={`${id}-policy`}
          className="mt-2 mb-1.5 block text-ink-muted"
        >
          Policy bundle (YAML) governing the fork in place of the agent's policy
        </label>
        <textarea
          id={`${id}-policy`}
          value={bundle}
          onChange={(e) => setBundle(e.target.value)}
          rows={6}
          spellCheck={false}
          className="field-control w-full px-2.5 py-1.5 font-mono text-xs leading-relaxed"
        />
      </details>
      {error && (
        <p className="text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={forking} className="button-primary">
          {forking ? "Forking…" : "Fork"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={forking}
          className="button-secondary"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
