"use client";

export default function DashError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      <p className="font-medium">Could not load this page.</p>
      <p className="mt-1">{error.message || "Server error"}{error.digest ? ` (ref ${error.digest})` : ""}</p>
      <button onClick={reset} className="mt-3 rounded border border-red-300 px-3 py-1 hover:bg-red-100">Try again</button>
    </div>
  );
}
