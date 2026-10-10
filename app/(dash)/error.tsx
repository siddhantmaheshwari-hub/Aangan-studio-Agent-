"use client";

export default function DashError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const dbMissing = /DATABASE_URL/.test(error.message);
  return (
    <div role="alert" className="rounded-lg border border-danger bg-danger-bg p-4 text-sm text-danger">
      <p className="font-semibold">This page couldn&apos;t load.</p>
      <p className="mt-1">
        {dbMissing
          ? "The database isn't connected yet (DATABASE_URL is missing). Add it in .env.local locally or in Vercel's environment variables, then reload."
          : `The server hit an error${error.digest ? ` (reference ${error.digest})` : ""}. Calls are not lost — they are saved before processing. Try again; if it repeats, check the health strip above.`}
      </p>
      <button onClick={reset} className="mt-3 min-h-9 rounded-md border border-danger px-3 hover:bg-surface">Try again</button>
    </div>
  );
}
