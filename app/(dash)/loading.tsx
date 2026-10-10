export default function Loading() {
  const block = "animate-pulse rounded-2xl bg-surface-2";
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <div className={`${block} h-9 w-72`} />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className={`${block} h-60 lg:col-span-2`} />
        <div className={`${block} h-60`} />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className={`${block} h-32`} />)}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
