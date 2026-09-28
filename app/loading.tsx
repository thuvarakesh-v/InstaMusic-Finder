import { ResultSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <section aria-label="Loading page">
      <ResultSkeleton count={4} />
    </section>
  );
}
