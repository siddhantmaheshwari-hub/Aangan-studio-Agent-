export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <div className="h-6 w-40 animate-pulse rounded bg-surface-2" />
      <div className="h-24 animate-pulse rounded-lg bg-surface-2" />
      <div className="h-48 animate-pulse rounded-lg bg-surface-2" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
