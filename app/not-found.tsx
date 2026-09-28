import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <div className="page-stack">
      <EmptyState
        title="Page not found"
        description="This page may have moved. Return to search to find a track."
        actionHref="/"
        actionLabel="Go to search"
      />
    </div>
  );
}
