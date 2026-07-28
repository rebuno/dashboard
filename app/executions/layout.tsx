import ExecutionListPanel from "@/components/executions/ExecutionListPanel";

export default function ExecutionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0">
      <div className="w-96 shrink-0 border-r border-gray-200 flex flex-col min-h-0">
        <ExecutionListPanel />
      </div>
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </div>
  );
}
