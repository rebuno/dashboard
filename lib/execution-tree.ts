import {
  type Execution,
  type ExecutionPage,
  getExecution,
  listExecutions,
  listSteps,
  type Step,
} from "./api";

export const isTerminal = (execution: Execution) =>
  ["completed", "failed", "cancelled"].includes(execution.status);

export function executionHref(
  id: string,
  { tree = false, stepId }: { tree?: boolean; stepId?: string } = {},
) {
  const query = new URLSearchParams();
  if (tree) query.set("view", "tree");
  if (stepId) query.set("step", stepId);
  const search = query.toString();
  return `/executions/${encodeURIComponent(id)}${search ? `?${search}` : ""}`;
}

// Subagent sessions usually embed the parent's ID; the remainder names the
// subagent.
export function executionLabel(execution: Execution) {
  const parent = execution.spawned_by?.execution_id;
  const at = parent ? (execution.session?.indexOf(parent) ?? -1) : -1;
  if (parent && at >= 0) {
    const name = execution
      .session!.slice(at + parent.length)
      .replace(/^[^\p{L}\p{N}]+/u, "");
    if (name) return name;
  }
  return execution.agent_id;
}

export function inputSummary(input: unknown) {
  if (typeof input === "string") return input;
  if (!input || typeof input !== "object") return undefined;
  return Object.values(input)
    .filter((value): value is string => typeof value === "string")
    .sort((a, b) => b.length - a.length)[0];
}

export interface TreeBranch {
  ids: string[];
  // Executions in other sessions that continue this one.
  branchedIds?: string[];
  forkIds?: string[];
  loaded: boolean;
  loading: boolean;
  // Whether subagents exist, known before the branch itself loads.
  hasSubagents?: boolean;
  nextCursor?: string;
  error?: string;
  steps?: Step[];
  stepsError?: string;
}

export interface ExecutionTreeState {
  selectedId: string;
  rootId?: string;
  // Executions in the root's session, oldest first.
  turns: string[];
  turnsTruncated?: boolean;
  turnsError?: string;
  path: string[];
  nodes: Record<string, Execution>;
  branches: Record<string, TreeBranch>;
  expanded: string[];
  loading: boolean;
  error?: string;
  ancestryWarning?: string;
  updatedAt?: number;
}

interface TreeAPI {
  getExecution: (id: string, signal?: AbortSignal) => Promise<Execution>;
  listExecutions: (
    params: {
      spawned_by?: string;
      session?: string;
      parent_execution_id?: string;
      forked_from?: string;
      limit: number;
      cursor?: string;
    },
    signal?: AbortSignal,
  ) => Promise<ExecutionPage>;
  listSteps: (id: string, signal?: AbortSignal) => Promise<Step[]>;
}

const emptyBranch = (): TreeBranch => ({
  ids: [],
  loaded: false,
  loading: false,
});
const message = (error: unknown) =>
  error instanceof Error ? error.message : "Unable to load execution data";

// One queue owns polling, pagination, and selection reads. Generations prevent
// a response from an abandoned selection from publishing into the current tree.
export class ExecutionTreeStore {
  private state: ExecutionTreeState = {
    selectedId: "",
    turns: [],
    path: [],
    nodes: {},
    branches: {},
    expanded: [],
    loading: false,
  };
  private listeners = new Set<() => void>();
  private generation = 0;
  private controller = new AbortController();
  private queue: Promise<unknown> = Promise.resolve();
  private refreshTask?: Promise<void>;

  constructor(
    private api: TreeAPI = { getExecution, listExecutions, listSteps },
  ) {}

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  invalidate = () => {
    this.generation++;
    this.controller.abort();
  };

  private update(patch: Partial<ExecutionTreeState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  private enqueue(work: () => Promise<void>) {
    const task = this.queue.then(work);
    this.queue = task.catch(() => {});
    return task;
  }

  select = (id: string) => {
    const generation = ++this.generation;
    this.controller.abort();
    this.controller = new AbortController();
    const knownPath: string[] = [];
    let known = this.state.nodes[id];
    while (known && !knownPath.includes(known.id) && knownPath.length < 64) {
      knownPath.unshift(known.id);
      if (known.id === this.state.rootId) break;
      known = this.state.nodes[known.spawned_by?.execution_id ?? ""];
    }
    const sameTree =
      knownPath.length > 0 && this.inTree(knownPath[0], this.state.rootId);
    this.update({
      selectedId: id,
      loading: !!id && !sameTree,
      ...(sameTree ? { path: knownPath } : {}),
      error: undefined,
      branches: Object.fromEntries(
        Object.entries(this.state.branches).map(([key, branch]) => [
          key,
          { ...branch, loading: false },
        ]),
      ),
    });
    if (!id) return Promise.resolve();
    return this.enqueue(async () => {
      if (generation !== this.generation) return;
      const ancestors: Execution[] = [];
      const seen = new Set<string>();
      let current: string | undefined = id;
      let ancestryWarning: string | undefined;
      try {
        while (current) {
          if (seen.has(current) || ancestors.length >= 64) {
            ancestryWarning =
              "Ancestry is incomplete. The parent chain could not be followed further.";
            break;
          }
          seen.add(current);
          let node: Execution;
          try {
            node =
              current === id
                ? await this.api.getExecution(current, this.controller.signal)
                : (this.state.nodes[current] ??
                  (await this.api.getExecution(
                    current,
                    this.controller.signal,
                  )));
          } catch (error) {
            if (ancestors.length === 0) throw error;
            ancestryWarning = `Parent unavailable: ${message(error)}`;
            break;
          }
          if (generation !== this.generation) return;
          ancestors.unshift(node);
          current = node.spawned_by?.execution_id;
        }
        if (generation !== this.generation) return;
        const rootId = ancestors[0].id;
        const sameRoot = this.inTree(rootId, this.state.rootId);
        const nodes = {
          ...(sameRoot ? this.state.nodes : {}),
          ...Object.fromEntries(ancestors.map((node) => [node.id, node])),
        };
        const branches = { ...(sameRoot ? this.state.branches : {}) };
        for (const child of ancestors.slice(1)) {
          const parent = child.spawned_by!.execution_id;
          const branch = branches[parent] ?? emptyBranch();
          branches[parent] = {
            ...branch,
            ids: [...new Set([...branch.ids, child.id])],
          };
        }
        this.update({
          rootId,
          ...(sameRoot ? {} : { turns: [], turnsTruncated: undefined }),
          turnsError: undefined,
          nodes,
          branches,
          path: ancestors.map((node) => node.id),
          expanded: [
            ...new Set([
              ...(sameRoot ? this.state.expanded : []),
              ...ancestors.slice(0, -1).map((node) => node.id),
              rootId,
            ]),
          ],
          loading: false,
          ancestryWarning,
          error: undefined,
          updatedAt: Date.now(),
        });
        // Selected steps and children take priority over sibling discovery.
        await this.loadBranchNow(id, false, generation);
        for (const ancestor of ancestors.slice(0, -1)) {
          if (generation !== this.generation) return;
          if (!this.state.branches[ancestor.id]?.loaded)
            await this.loadBranchNow(ancestor.id, false, generation);
        }
        await this.loadTurnsNow(generation);
        for (const turn of this.state.turns) {
          if (generation !== this.generation) return;
          if (!this.state.branches[turn]?.loaded)
            await this.loadBranchNow(turn, false, generation);
        }
      } catch (error) {
        if (generation === this.generation)
          this.update({
            loading: false,
            error: message(error),
            ...(!sameTree
              ? {
                  rootId: undefined,
                  turns: [],
                  path: [],
                  nodes: {},
                  branches: {},
                  expanded: [],
                }
              : {}),
          });
      }
    });
  };

  // One-row lookups tell a leaf from a branch without loading every subagent's
  // steps. A live leaf may still start subagents, so it is checked again.
  private async probeChildren(ids: string[], generation: number) {
    const pending = ids.filter((child) => {
      const known = this.state.branches[child];
      if (known?.loaded) return false;
      return (
        known?.hasSubagents === undefined ||
        (!known.hasSubagents && !isTerminal(this.state.nodes[child]))
      );
    });
    for (let offset = 0; offset < pending.length; offset += 4) {
      const batch = pending.slice(offset, offset + 4);
      const results = await Promise.allSettled(
        batch.map((child) =>
          this.api.listExecutions(
            { spawned_by: child, limit: 1 },
            this.controller.signal,
          ),
        ),
      );
      if (generation !== this.generation) return;
      const branches = { ...this.state.branches };
      results.forEach((result, index) => {
        if (result.status !== "fulfilled") return;
        const child = batch[index];
        branches[child] = {
          ...(branches[child] ?? emptyBranch()),
          hasSubagents: result.value.executions.length > 0,
        };
      });
      this.update({ branches });
    }
  }

  private inTree(id: string, rootId?: string) {
    return id === rootId || this.state.turns.includes(id);
  }

  private async loadTurnsNow(generation: number, observed?: Set<string>) {
    const session = this.state.nodes[this.state.rootId ?? ""]?.session;
    if (!session) {
      if (this.state.turns.length) this.update({ turns: [] });
      return;
    }
    try {
      const page = await this.api.listExecutions(
        { session, limit: 200 },
        this.controller.signal,
      );
      if (generation !== this.generation) return;
      const executions = page.executions
        .filter((node) => !node.spawned_by)
        .sort((a, b) => a.id.localeCompare(b.id));
      for (const node of executions) observed?.add(node.id);
      this.update({
        turns: executions.map((node) => node.id),
        turnsTruncated: !!page.next_cursor,
        turnsError: undefined,
        nodes: {
          ...this.state.nodes,
          ...Object.fromEntries(executions.map((node) => [node.id, node])),
        },
      });
    } catch (error) {
      if (generation === this.generation)
        this.update({ turnsError: message(error) });
    }
  }

  toggle = (id: string) => {
    const expanded = this.state.expanded.includes(id);
    this.update({
      expanded: expanded
        ? this.state.expanded.filter((value) => value !== id)
        : [...this.state.expanded, id],
    });
    if (!expanded && !this.state.branches[id]?.loaded)
      return this.loadBranch(id);
    return Promise.resolve();
  };

  loadBranch = (id: string, more = false) => {
    const generation = this.generation;
    return this.enqueue(() => this.loadBranchNow(id, more, generation));
  };

  private async loadBranchNow(
    id: string,
    more: boolean,
    generation: number,
    observed?: Set<string>,
  ) {
    if (generation !== this.generation || !this.state.nodes[id]) return;
    const previous = this.state.branches[id] ?? emptyBranch();
    if (more && !previous.nextCursor) return;
    // Refreshing a loaded branch keeps showing what it has.
    if (more || !previous.loaded)
      this.update({
        branches: {
          ...this.state.branches,
          [id]: { ...previous, loading: true },
        },
      });
    const node = this.state.nodes[id];
    const [children, steps, continuations, forks] = await Promise.allSettled([
      this.api.listExecutions(
        {
          spawned_by: id,
          limit: 200,
          cursor: more ? previous.nextCursor : undefined,
        },
        this.controller.signal,
      ),
      id === this.state.selectedId ||
      !previous.steps ||
      !isTerminal(this.state.nodes[id]) ||
      previous.steps.some((step) =>
        ["executing", "awaiting_approval"].includes(step.status),
      )
        ? this.api.listSteps(id, this.controller.signal)
        : Promise.resolve(previous.steps),
      more || node.spawned_by
        ? Promise.resolve(undefined)
        : this.api.listExecutions(
            { parent_execution_id: id, limit: 200 },
            this.controller.signal,
          ),
      more || id !== this.state.selectedId
        ? Promise.resolve(undefined)
        : this.api.listExecutions(
            { forked_from: id, limit: 200 },
            this.controller.signal,
          ),
    ]);
    if (generation !== this.generation) return;
    const branch = { ...previous, loading: false };
    let nodes = this.state.nodes;
    if (children.status === "fulfilled") {
      const page = children.value;
      if (more && page.next_cursor === previous.nextCursor) {
        branch.error =
          "Subagent pagination did not advance. Retry loading this branch.";
      } else {
        const overlaps = page.executions.some((node) =>
          previous.ids.includes(node.id),
        );
        branch.nextCursor =
          more || !previous.loaded || (page.next_cursor && !overlaps)
            ? page.next_cursor
            : previous.nextCursor;
        branch.ids = [
          ...new Set([
            ...previous.ids,
            ...page.executions.map((node) => node.id),
          ]),
        ];
        branch.loaded = true;
        branch.error = undefined;
        nodes = {
          ...nodes,
          ...Object.fromEntries(page.executions.map((node) => [node.id, node])),
        };
        for (const node of page.executions) observed?.add(node.id);
      }
    } else {
      branch.error = message(children.reason);
    }
    if (continuations.status === "fulfilled" && continuations.value) {
      const branched = continuations.value.executions.filter(
        (other) =>
          !other.forked_from &&
          !other.spawned_by &&
          !(node.session && other.session === node.session),
      );
      branch.branchedIds = branched.map((other) => other.id).reverse();
      nodes = {
        ...nodes,
        ...Object.fromEntries(branched.map((other) => [other.id, other])),
      };
    }
    if (forks.status === "fulfilled" && forks.value) {
      const forked = forks.value.executions;
      branch.forkIds = forked.map((other) => other.id).reverse();
      nodes = {
        ...nodes,
        ...Object.fromEntries(forked.map((other) => [other.id, other])),
      };
    }
    if (steps.status === "fulfilled") {
      branch.steps = steps.value;
      branch.stepsError = undefined;
    } else {
      branch.stepsError = message(steps.reason);
    }
    this.update({ nodes, branches: { ...this.state.branches, [id]: branch } });
    await this.probeChildren(branch.ids, generation);
  }

  refresh = () => {
    if (this.state.loading || !this.state.selectedId) return Promise.resolve();
    if (this.refreshTask) return this.refreshTask;
    if (!this.state.nodes[this.state.selectedId])
      return this.select(this.state.selectedId);
    const generation = this.generation;
    const task = this.enqueue(async () => {
      if (generation !== this.generation) return;
      const observed = new Set<string>();
      const parents = new Set([
        ...this.state.expanded,
        ...this.state.path,
        this.state.selectedId,
      ]);
      for (const id of parents) {
        if (generation !== this.generation) return;
        await this.loadBranchNow(id, false, generation, observed);
      }
      await this.loadTurnsNow(generation, observed);
      for (const turn of this.state.turns) {
        if (generation !== this.generation) return;
        if (
          !parents.has(turn) &&
          (!this.state.branches[turn]?.loaded ||
            !isTerminal(this.state.nodes[turn]))
        )
          await this.loadBranchNow(turn, false, generation, observed);
      }
      if (generation !== this.generation) return;
      const ids = Object.values(this.state.nodes)
        .filter(
          (node) =>
            !observed.has(node.id) &&
            (node.id === this.state.selectedId || !isTerminal(node)),
        )
        .map((node) => node.id);
      let error: string | undefined;
      for (let offset = 0; offset < ids.length; offset += 4) {
        const batch = await Promise.allSettled(
          ids
            .slice(offset, offset + 4)
            .map((id) => this.api.getExecution(id, this.controller.signal)),
        );
        if (generation !== this.generation) return;
        const nodes = { ...this.state.nodes };
        for (const result of batch) {
          if (result.status === "fulfilled")
            nodes[result.value.id] = result.value;
          else error = message(result.reason);
        }
        this.update({ nodes });
      }
      if (generation === this.generation)
        this.update({ error, ...(!error ? { updatedAt: Date.now() } : {}) });
    });
    this.refreshTask = task;
    void task.finally(() => {
      if (this.refreshTask === task) this.refreshTask = undefined;
    });
    return task;
  };

  refreshAfterMutation = async () => {
    await this.queue;
    return this.refresh();
  };
}
