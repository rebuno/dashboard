"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import ExecutionListPanel from "@/components/executions/ExecutionListPanel";
import ExecutionTreePanel from "@/components/executions/ExecutionTreePanel";
import { cancelExecution } from "@/lib/api";
import { EXECUTION_DETAIL_POLL_INTERVAL } from "@/lib/constants";
import {
  type ExecutionTreeState,
  ExecutionTreeStore,
  executionHref,
} from "@/lib/execution-tree";
import { usePolling } from "@/lib/hooks";

type ActionState = { pending: boolean; error?: string };
const WorkspaceContext = createContext<{
  store: ExecutionTreeStore;
  tree: ExecutionTreeState;
  treeMode: boolean;
  actions: Record<string, ActionState>;
  cancel: (id: string) => Promise<void>;
  back: () => void;
} | null>(null);

export function useExecutionWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("Execution workspace is required");
  return value;
}

export default function ExecutionWorkspace({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const selectedId = pathname.split("/")[2] ?? "";
  const [store] = useState(() => new ExecutionTreeStore());
  const tree = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  const [actions, setActions] = useState<Record<string, ActionState>>({});
  const [mobileTree, setMobileTree] = useState(false);
  const treeMode = !!selectedId && params.get("view") === "tree";
  const router = useRouter();
  // Moves within one tree replace the history entry and moves to another tree
  // push one, so Back returns to the previous tree or the page that opened it.
  function back() {
    const { navigation } = window as Window & {
      navigation?: {
        currentEntry: { index: number } | null;
        entries(): { url: string | null }[];
      };
    };
    const index = navigation?.currentEntry?.index;
    const previous =
      index != null ? navigation?.entries()[index - 1]?.url : undefined;
    const inDashboard =
      index != null
        ? !!previous && new URL(previous).origin === window.location.origin
        : window.history.length > 1;
    if (inDashboard) router.back();
    else router.push(executionHref(selectedId));
  }

  useEffect(() => {
    void store.select(selectedId);
    setMobileTree(false);
    return store.invalidate;
  }, [store, selectedId]);
  usePolling(store.refresh, EXECUTION_DETAIL_POLL_INTERVAL, [
    store,
    selectedId,
  ]);

  async function cancel(id: string) {
    setActions((previous) => ({ ...previous, [id]: { pending: true } }));
    try {
      await cancelExecution(id);
      await store.refreshAfterMutation();
      setActions((previous) => ({ ...previous, [id]: { pending: false } }));
    } catch (error) {
      setActions((previous) => ({
        ...previous,
        [id]: {
          pending: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to cancel execution",
        },
      }));
    }
  }

  return (
    <WorkspaceContext.Provider
      value={{ store, tree, treeMode, actions, cancel, back }}
    >
      <div className="flex h-full min-h-0 flex-col bg-canvas">
        {treeMode && (
          <div
            className="flex shrink-0 gap-2 border-b border-line bg-surface px-4 py-2 lg:hidden"
            aria-label="Execution view"
          >
            <button
              type="button"
              aria-pressed={mobileTree}
              onClick={() => setMobileTree(true)}
              className={`button-secondary ${mobileTree ? "text-accent" : ""}`}
            >
              Tree
            </button>
            <button
              type="button"
              aria-pressed={!mobileTree}
              onClick={() => setMobileTree(false)}
              className={`button-secondary ${!mobileTree ? "text-accent" : ""}`}
            >
              Details
            </button>
          </div>
        )}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className={`${treeMode ? "hidden" : "contents"}`}>
            <ExecutionListPanel active={!treeMode} />
          </div>
          {treeMode && (
            <div
              className={`${mobileTree ? "flex" : "hidden"} min-h-0 w-full shrink-0 lg:flex lg:w-[22rem]`}
            >
              <ExecutionTreePanel onSelect={() => setMobileTree(false)} />
            </div>
          )}
          <div
            className={`${treeMode && mobileTree ? "hidden lg:flex" : "flex"} min-h-0 min-w-0 flex-1 flex-col bg-surface`}
          >
            {children}
          </div>
        </div>
      </div>
    </WorkspaceContext.Provider>
  );
}
