"use client";

import Link from "next/link";
import BranchIcon from "@/components/executions/BranchIcon";
import { useExecutionWorkspace } from "@/components/executions/ExecutionWorkspace";
import StatusBadge from "@/components/StatusBadge";
import {
  executionHref,
  executionLabel,
  inputSummary,
} from "@/lib/execution-tree";

export default function ExecutionTreePanel({
  onSelect,
}: {
  onSelect: () => void;
}) {
  const { store, tree, back } = useExecutionWorkspace();

  function nodeRow(
    id: string,
    depth = 0,
    ancestors: string[] = [],
    label?: string,
    note?: string,
  ) {
    const node = tree.nodes[id];
    if (!node || ancestors.includes(id)) return null;
    const branch = tree.branches[id];
    const expanded = tree.expanded.includes(id);
    const selected = tree.selectedId === id;
    const hasChildren =
      !!branch?.ids.length ||
      !!branch?.nextCursor ||
      (!branch?.loaded && !!branch?.hasSubagents);
    const expandable = hasChildren || !!branch?.error || !!branch?.loading;
    const parentSteps = node.spawned_by
      ? tree.branches[node.spawned_by.execution_id]?.steps
      : undefined;
    const spawningStep = parentSteps?.find(
      (step) => step.step_id === node.spawned_by?.step_id,
    );
    const summary = inputSummary(node.input);
    const children = [...(branch?.ids ?? [])].sort(
      (a, b) =>
        tree.nodes[a].created_at.localeCompare(tree.nodes[b].created_at) ||
        a.localeCompare(b),
    );

    const conversations = new Map<string, string[]>();
    for (const child of children) {
      const execution = tree.nodes[child];
      const key = execution.session
        ? JSON.stringify([execution.agent_id, execution.session])
        : child;
      const turns = conversations.get(key) ?? [];
      turns.push(child);
      conversations.set(key, turns);
    }

    return (
      <li key={id}>
        <div
          className={`group relative flex items-start border-b border-line pr-3 ${selected ? "bg-accent-wash" : "hover:bg-surface-muted"}`}
          style={{ paddingLeft: 8 + Math.min(depth, 6) * 16 }}
        >
          {depth > 0 && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-0 h-8 w-3 rounded-bl border-b border-l border-line-strong"
              style={{ left: 8 + (Math.min(depth, 6) - 1) * 16 }}
            />
          )}
          {selected && (
            <span className="absolute inset-y-0 left-0 w-0.5 bg-accent" />
          )}
          {expandable ? (
            <button
              type="button"
              onClick={() => void store.toggle(id)}
              aria-expanded={expanded}
              aria-label={`${branch?.loading ? "Loading subagents of" : expanded ? "Collapse" : "Expand"} ${executionLabel(node)} ${id.slice(-8)}`}
              className="mt-3 h-8 w-7 shrink-0 rounded text-ink-muted hover:text-ink"
            >
              {branch?.loading ? (
                <span
                  aria-hidden="true"
                  className="mx-auto block h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent"
                />
              ) : (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className={`mx-auto h-3.5 w-3.5 ${expanded ? "rotate-90" : ""}`}
                >
                  <path d="m6 3 5 5-5 5" />
                </svg>
              )}
            </button>
          ) : (
            <span aria-hidden="true" className="mt-3 h-8 w-7 shrink-0" />
          )}
          <Link
            replace
            href={executionHref(id, { tree: true })}
            scroll={false}
            onClick={onSelect}
            aria-current={selected ? "page" : undefined}
            title={`${node.agent_id} · ${id}${summary ? `\n${summary}` : ""}`}
            className="min-w-0 flex-1 py-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="min-w-0 truncate text-sm font-medium text-ink">
                {label ?? executionLabel(node)}
              </span>
              <StatusBadge status={node.status} />
            </div>
            <div className="mt-1.5 line-clamp-2 text-[11px] text-ink-muted">
              {summary ??
                (node.spawned_by
                  ? (spawningStep?.target ??
                    `Step ${node.spawned_by.step_id.slice(0, 8)}`)
                  : "Root execution")}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-2 text-[10px] text-ink-faint">
              <code>{id.slice(-8)}</code>
              {note && <span>{note}</span>}
              {!expanded && !!branch?.ids.length && (
                <span>
                  {branch.ids.length}
                  {branch.nextCursor ? "+" : ""} subagent
                  {branch.ids.length === 1 && !branch.nextCursor ? "" : "s"}
                </span>
              )}
            </div>
          </Link>
        </div>
        {expanded && expandable && (
          <ul
            aria-label={`Subagents of ${node.agent_id} ${id.slice(-8)}`}
            className="relative"
          >
            {[...conversations.values()].map((turns) =>
              turns.length === 1 ? (
                nodeRow(turns[0], depth + 1, [...ancestors, id])
              ) : (
                <li key={turns[0]}>
                  <div
                    className="flex items-center justify-between gap-2 border-b border-line bg-surface-muted py-3 pr-3"
                    style={{ paddingLeft: 36 + Math.min(depth + 1, 6) * 16 }}
                  >
                    <span className="truncate text-sm font-medium">
                      {executionLabel(tree.nodes[turns[0]])}
                    </span>
                    <span className="shrink-0 text-xs text-ink-muted">
                      {turns.length} turns
                    </span>
                  </div>
                  <ul
                    aria-label={`Conversation turns of ${executionLabel(tree.nodes[turns[0]])}`}
                  >
                    {turns.map((child, index) =>
                      nodeRow(
                        child,
                        depth + 1,
                        [...ancestors, id],
                        `Turn ${index + 1}`,
                        turnNote(turns, index),
                      ),
                    )}
                  </ul>
                </li>
              ),
            )}
            {branch?.error && (
              <li
                className="border-b border-line px-4 py-3 text-xs text-red-600 dark:text-red-400"
                role="status"
              >
                <p>{branch.error}</p>
                <button
                  type="button"
                  onClick={() => void store.loadBranch(id)}
                  disabled={branch.loading}
                  className="mt-2 font-medium underline disabled:opacity-50"
                >
                  Retry branch
                </button>
              </li>
            )}
            {branch?.nextCursor && (
              <li className="border-b border-line px-5 py-3">
                <button
                  type="button"
                  onClick={() => void store.loadBranch(id, true)}
                  disabled={branch.loading}
                  className="text-xs font-medium text-accent disabled:opacity-50"
                >
                  {branch.loading ? "Loading…" : "Load more subagents"}
                </button>
              </li>
            )}
          </ul>
        )}
        {!!branch?.branchedIds?.length && (
          <ul aria-label={`Sessions continuing ${id.slice(-8)}`}>
            {branch.branchedIds.map((other) => branchRow(other, depth + 1))}
          </ul>
        )}
      </li>
    );
  }

  function branchRow(id: string, depth: number) {
    const node = tree.nodes[id];
    const summary = inputSummary(node.input);
    return (
      <li key={id}>
        <Link
          href={executionHref(id, { tree: true })}
          onClick={onSelect}
          title={`Branches into ${node.session ?? id}`}
          className="flex items-start gap-2 border-b border-line py-3 pr-3 hover:bg-surface-muted"
          style={{ paddingLeft: 8 + Math.min(depth, 6) * 16 }}
        >
          <span className="flex h-5 w-7 shrink-0 items-center justify-center text-ink-muted">
            <BranchIcon className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-1.5">
              <code className="min-w-0 truncate text-xs text-ink-soft">
                {node.session ?? id.slice(-8)}
              </code>
              <StatusBadge status={node.status} />
            </span>
            {summary && (
              <span className="mt-1 line-clamp-2 text-[11px] text-ink-muted">
                {summary}
              </span>
            )}
          </span>
        </Link>
      </li>
    );
  }

  // Each turn continues the session's latest completed turn, which is not the
  // one before it when that one failed or was cancelled.
  function turnNote(turns: string[], index: number) {
    const previous = tree.nodes[turns[index]].parent_execution_id;
    if (!previous || previous === turns[index - 1]) return undefined;
    const at = turns.indexOf(previous);
    return at >= 0 ? `continues turn ${at + 1}` : undefined;
  }

  const plural = (count: number, noun: string, suffix = "") =>
    `${count}${suffix} ${noun}${count === 1 && !suffix ? "" : "s"}`;
  const root = tree.rootId ? tree.nodes[tree.rootId] : undefined;
  const session = tree.turns.length > 1 ? root?.session : undefined;
  const origin = session ? tree.nodes[tree.turns[0]] : root;
  const forkedFrom = origin?.forked_from;
  const branchedFrom = forkedFrom ? undefined : origin?.parent_execution_id;
  const rootBranch = tree.rootId ? tree.branches[tree.rootId] : undefined;
  return (
    <section
      className="flex h-full min-h-0 w-full flex-col border-r border-line bg-surface"
      aria-label="Execution tree"
    >
      <header className="border-b border-line px-4 py-4">
        <button
          type="button"
          onClick={back}
          className="inline-flex min-h-8 items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
        >
          <span aria-hidden="true">←</span> Back
        </button>
        <div className="mt-2 flex items-center justify-between gap-3">
          <h2 className="min-w-0 text-base font-semibold tracking-[-0.015em]">
            {session ? "Session" : "Execution tree"}
          </h2>
          <span className="rounded border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-muted">
            Live
          </span>
        </div>
        {root?.session && (
          <code
            className="mt-1 block truncate text-xs text-ink-soft"
            title={root.session}
          >
            {root.session}
          </code>
        )}
        <p className="mt-1 text-xs text-ink-muted">
          {tree.loading
            ? "Finding ancestors…"
            : [
                root?.session &&
                  plural(
                    tree.turns.length,
                    "turn",
                    tree.turnsTruncated ? "+" : "",
                  ),
                `${plural(Object.keys(tree.nodes).length, "execution")} loaded`,
              ]
                .filter(Boolean)
                .join(" · ")}
        </p>
        {forkedFrom && (
          <p className="mt-1 text-xs text-ink-muted">
            Forked from{" "}
            <Link
              href={executionHref(forkedFrom, { tree: true })}
              className="font-mono text-accent hover:underline"
            >
              {forkedFrom.slice(-8)}
            </Link>{" "}
            at event {origin?.fork_seq}
          </p>
        )}
        {branchedFrom && (
          <p className="mt-1 text-xs text-ink-muted">
            Branched from{" "}
            <Link
              href={executionHref(branchedFrom, { tree: true })}
              className="font-mono text-accent hover:underline"
            >
              {branchedFrom.slice(-8)}
            </Link>
          </p>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tree.loading ? (
          <div className="space-y-4 p-5" role="status">
            <p className="text-sm text-ink-muted">Loading execution tree…</p>
            {[0, 1, 2].map((n) => (
              <div
                key={n}
                className="h-12 rounded bg-surface-muted"
                style={{ marginLeft: n * 16 }}
              />
            ))}
          </div>
        ) : (
          <>
            {tree.ancestryWarning && (
              <div
                className="m-3 rounded border border-line bg-surface-muted p-3 text-xs text-ink-muted"
                role="status"
              >
                <p>{tree.ancestryWarning}</p>
                <button
                  type="button"
                  onClick={() => void store.select(tree.selectedId)}
                  className="mt-2 font-medium underline"
                >
                  Retry ancestry
                </button>
              </div>
            )}
            {tree.error && (
              <div
                className="m-3 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                role="status"
              >
                <p>Updates paused: {tree.error}</p>
                {tree.updatedAt && (
                  <p className="mt-1">
                    Last updated {new Date(tree.updatedAt).toLocaleTimeString()}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void store.refresh()}
                  className="mt-2 font-medium underline"
                >
                  Retry
                </button>
              </div>
            )}
            {tree.turnsError && (
              <p
                className="m-3 text-xs text-red-600 dark:text-red-400"
                role="status"
              >
                Session turns unavailable: {tree.turnsError}
              </p>
            )}
            {tree.turnsTruncated && (
              <p className="px-4 py-3 text-xs text-ink-muted">
                Showing the latest {tree.turns.length} turns.
              </p>
            )}
            {session ? (
              <ul aria-label="Session turns">
                {tree.turns.map((turn, index) =>
                  nodeRow(
                    turn,
                    0,
                    [],
                    tree.turnsTruncated ? undefined : `Turn ${index + 1}`,
                    turnNote(tree.turns, index),
                  ),
                )}
              </ul>
            ) : (
              tree.rootId && (
                <ul aria-label="Execution hierarchy">{nodeRow(tree.rootId)}</ul>
              )
            )}
            {!session &&
              rootBranch?.loaded &&
              !rootBranch.error &&
              rootBranch.ids.length === 0 &&
              !rootBranch.nextCursor &&
              !rootBranch.branchedIds?.length && (
                <div className="m-4 rounded-lg border border-dashed border-line-strong px-4 py-8 text-center">
                  <p className="text-sm font-medium text-ink-soft">
                    Nothing else in this tree
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {root?.session
                      ? "This is the only turn in its session, and it started no subagents."
                      : "This execution started no subagents and belongs to no session."}
                  </p>
                </div>
              )}
          </>
        )}
      </div>
      <p className="border-t border-line px-4 py-3 text-[11px] leading-relaxed text-ink-muted">
        Expand an execution to show the subagents it started. Select one to
        inspect its steps and events.
      </p>
    </section>
  );
}
