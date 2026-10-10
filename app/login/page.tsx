import { buttonPrimary, inputCls } from "@/components/ui";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form method="post" action="/api/login" className="w-full max-w-sm space-y-4 rounded-xl border border-line bg-surface p-6 shadow-sm">
        <div>
          <h1 className="text-lg font-semibold">Aangan Studio · Enquiries</h1>
          <p className="mt-1 text-sm text-fg-2">Every phone enquiry the agent answered, with what happens next.</p>
        </div>
        <label className="block text-sm">
          <span className="font-medium">Team password</span>
          <input name="password" type="password" required autoFocus autoComplete="current-password"
            aria-invalid={error ? true : undefined} aria-describedby={error ? "login-error" : undefined}
            className={`${inputCls} mt-1 w-full px-3`} />
        </label>
        {error && <p id="login-error" role="alert" className="text-sm text-danger">That password didn&apos;t match. Check with the founder for the current one.</p>}
        <button className={`${buttonPrimary} w-full`}>Open dashboard</button>
      </form>
    </main>
  );
}
