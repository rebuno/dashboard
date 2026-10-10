import { Suspense } from "react";
import ExecutionWorkspace from "@/components/executions/ExecutionWorkspace";

export default function ExecutionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="p-5 text-sm text-ink-muted">Loading executions…</div>
      }
    >
      <ExecutionWorkspace>{children}</ExecutionWorkspace>
    </Suspense>
  );
}
