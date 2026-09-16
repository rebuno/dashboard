import ExecutionListPanel from "@/components/executions/ExecutionListPanel";

export default function ExecutionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas md:flex-row">
      <ExecutionListPanel />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface">
        {children}
      </div>
    </div>
  );
}
