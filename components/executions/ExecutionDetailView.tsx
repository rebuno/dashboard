"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import EventsPanel from "@/components/executions/EventsPanel";
import { useExecutionWorkspace } from "@/components/executions/ExecutionWorkspace";
import StepsPanel from "@/components/executions/StepsPanel";
import JsonBlock from "@/components/JsonBlock";
import StatusBadge from "@/components/StatusBadge";
import {
  executionHref,
  isTerminal as executionIsTerminal,
  executionLabel,
} from "@/lib/execution-tree";
import { useExecutionEvents } from "@/lib/hooks";

export default function ExecutionDetailView({
  executionId,
}: {
  executionId: string;
}) {
  const { tree, store, treeMode, actions, cancel } = useExecutionWorkspace();
  const params = useSearchParams();
  const router = useRouter();
  const execution =
    tree.selectedId === executionId ? tree.nodes[executionId] : undefined;
  const error = tree.error;
  const loading = tree.loading || tree.selectedId !== executionId;
  const [tab, setTab] = useState<"steps" | "events">("steps");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const cancelling = actions[executionId]?.pending;
  const cancelError = actions[executionId]?.error;

  const eventLog = useExecutionEvents(executionId);
  const lastEventAt = eventLog.events.at(-1)?.occurred_at;

  async function handleCancel() {
    setConfirmCancel(false);
    await cancel(executionId);
  }

  if (loading)
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-ink-muted">
        Loading execution…
      </div>
    );
  if (error && !execution)
    return (
      <div className="m-5 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        {error}
        <button
          type="button"
          onClick={() => void store.refresh()}
          className="ml-3 underline"
        >
          Retry
        </button>
      </div>
    );
  if (!execution) return null;

  const isTerminal = executionIsTerminal(execution);
  const branch = tree.branches[executionId];
  const liveChildren = (branch?.ids ?? []).filter(
    (id) =>
      !executionIsTerminal(tree.nodes[id]) &&
      branch?.steps?.some(
        (step) =>
          step.step_id === tree.nodes[id].spawned_by?.step_id &&
          step.status === "executing",
      ),
  );
  const approvals =
    branch?.steps?.filter((step) => step.status === "awaiting_approval")
      .length ?? 0;
  const spawning = execution.spawned_by;
  const parent = spawning ? tree.nodes[spawning.execution_id] : undefined;
  const parentStep = spawning
    ? tree.branches[spawning.execution_id]?.steps?.find(
        (step) => step.step_id === spawning.step_id,
      )
    : undefined;
  const activeTab = params.get("step") ? "steps" : tab;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b border-line px-5 py-5 md:px-6">
        {treeMode && tree.path.length > 1 && (
          <nav
            aria-label="Execution ancestors"
            className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted"
          >
            {tree.path.map((id, index) => (
              <span key={id} className="inline-flex items-center gap-2">
                {index > 0 && <span aria-hidden="true">/</span>}
                <Link
                  replace
                  href={executionHref(id, { tree: true })}
                  aria-current={id === executionId ? "page" : undefined}
                  className="max-w-40 truncate hover:text-accent"
                >
                  {tree.turns.length > 1 &&
                  tree.turns.includes(id) &&
                  !tree.turnsTruncated
                    ? `Turn ${tree.turns.indexOf(id) + 1}`
                    : executionLabel(tree.nodes[id])}
                </Link>
              </span>
            ))}
          </nav>
        )}
        <Link
          href="/executions"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink md:hidden"
        >
          <span aria-hidden="true">←</span> All executions
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="truncate text-lg font-semibold tracking-[-0.02em]">
                {executionLabel(execution)}
              </h1>
              {executionLabel(execution) !== execution.agent_id && (
                <span className="text-xs text-ink-muted">
                  {execution.agent_id}
                </span>
              )}
              <StatusBadge status={execution.status} />
            </div>
            <code className="mt-1.5 block truncate text-[11px] text-ink-muted">
              {execution.id}
            </code>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            {!treeMode && (
              <Link
                href={executionHref(executionId, { tree: true })}
                className="button-secondary"
              >
                View tree
              </Link>
            )}
            <button
              type="button"
              onClick={() => setConfirmCancel(true)}
              disabled={isTerminal || cancelling}
              className="button-danger shrink-0"
            >
              {cancelling ? "Cancelling…" : "Cancel"}
            </button>
          </div>
        </div>
        {spawning && (
          <div className="mt-4 rounded-md border border-line bg-surface-muted px-3 py-2.5 text-xs text-ink-muted">
            Spawned by{" "}
            <Link
              replace={treeMode}
              href={executionHref(spawning.execution_id, { tree: treeMode })}
              className="font-medium text-accent hover:underline"
            >
              {parent ? executionLabel(parent) : spawning.execution_id}
            </Link>
            <span className="mx-1.5">via</span>
            <Link
              replace={treeMode}
              href={executionHref(spawning.execution_id, {
                tree: treeMode,
                stepId: spawning.step_id,
              })}
              className="font-mono text-[11px] text-accent hover:underline"
              title={spawning.step_id}
            >
              {parentStep?.target ?? `step ${spawning.step_id.slice(0, 8)}`}{" "}
              <span aria-hidden="true">↗</span>
            </Link>
            {isTerminal && parentStep?.status === "executing" && (
              <p className="mt-1.5">Result pending in parent step.</p>
            )}
          </div>
        )}
        {(liveChildren.length > 0 || approvals > 0) && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
            {liveChildren.length > 0 && (
              <span>
                {branch?.error || branch?.nextCursor ? "At least " : ""}
                {liveChildren.length} live subagent
                {liveChildren.length === 1 ? "" : "s"}
                {branch?.error || branch?.stepsError ? " · last known" : ""}
              </span>
            )}
            {approvals > 0 && (
              <Link href="/approvals" className="text-accent hover:underline">
                {approvals} step{approvals === 1 ? "" : "s"} awaiting approval ↗
                {branch?.stepsError ? " · last known" : ""}
              </Link>
            )}
          </div>
        )}
        {error && (
          <p
            className="mt-3 text-xs text-red-600 dark:text-red-400"
            role="status"
          >
            Updates paused: {error}
          </p>
        )}
        {confirmCancel && !isTerminal && (
          <div className="mt-4 rounded-md border border-line-strong bg-surface-muted p-3 text-xs">
            <p className="font-medium">
              Cancel this execution and its live subagents?
            </p>
            {spawning && (
              <p className="mt-1 text-ink-muted">Its parent step will fail.</p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="button-danger"
              >
                Cancel execution
              </button>
              <button
                type="button"
                onClick={() => setConfirmCancel(false)}
                className="button-secondary"
              >
                Keep running
              </button>
            </div>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-muted">
          <span>Created {new Date(execution.created_at).toLocaleString()}</span>
          <span>
            Updated{" "}
            {new Date(
              lastEventAt &&
                Date.parse(lastEventAt) > Date.parse(execution.updated_at)
                ? lastEventAt
                : execution.updated_at,
            ).toLocaleString()}
          </span>
          {execution.deadline_at && (
            <span>
              Deadline {new Date(execution.deadline_at).toLocaleString()}
            </span>
          )}
          {execution.session && <span>Session {execution.session}</span>}
          {execution.parent_execution_id && (
            <span>
              Continues{" "}
              <Link
                replace={
                  treeMode && !!tree.nodes[execution.parent_execution_id]
                }
                href={executionHref(execution.parent_execution_id, {
                  tree: treeMode,
                })}
                className="font-mono text-[11px] text-accent hover:underline"
              >
                {execution.parent_execution_id}
              </Link>
            </span>
          )}
          {execution.forked_from && (
            <span>
              Forked from{" "}
              <Link
                href={executionHref(execution.forked_from, {
                  tree: treeMode,
                })}
                className="font-mono text-[11px] text-accent hover:underline"
              >
                {execution.forked_from}
              </Link>{" "}
              at event {execution.fork_seq}
            </span>
          )}
        </div>
        {execution.failure_reason && (
          <p
            className={`mt-3 rounded-md border px-3 py-2 text-xs ${
              execution.status === "cancelled"
                ? "border-line bg-surface-muted text-ink-muted"
                : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
            }`}
          >
            <span className="font-medium">
              {execution.status === "cancelled" ? "Reason:" : "Failure:"}
            </span>{" "}
            {execution.failure_reason}
          </p>
        )}
        {cancelError && (
          <div
            className="mt-3 text-xs text-red-600 dark:text-red-400"
            role="alert"
          >
            {cancelError}
          </div>
        )}
        <div className="mt-4 flex flex-col gap-2">
          <JsonBlock label="Input" value={execution.input} />
          <JsonBlock label="Output" value={execution.output} />
        </div>
      </header>
      <div
        className="flex gap-5 border-b border-line px-5 md:px-6"
        role="tablist"
      >
        {(["steps", "events"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              if (params.has("step"))
                router.replace(executionHref(executionId, { tree: treeMode }), {
                  scroll: false,
                });
            }}
            role="tab"
            aria-selected={activeTab === t}
            className={`relative py-3 text-sm font-medium transition-colors ${
              activeTab === t
                ? "text-accent after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-accent"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {t === "steps" ? "Steps" : "Events"}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === "steps" ? (
          <StepsPanel
            key={executionId}
            executionId={executionId}
            events={eventLog.events}
          />
        ) : (
          <EventsPanel {...eventLog} />
        )}
      </div>
    </div>
  );
}
