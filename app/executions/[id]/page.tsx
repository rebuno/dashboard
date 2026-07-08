import ExecutionDetailView from "@/components/executions/ExecutionDetailView";

export default async function ExecutionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExecutionDetailView executionId={id} />;
}
