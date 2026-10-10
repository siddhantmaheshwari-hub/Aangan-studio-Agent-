import { buttonPrimary, inputCls } from "@/components/ui";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-3xl overflow-hidden rounded-3xl border border-line bg-surface shadow-card md:grid-cols-2">
        <div className="relative hidden flex-col justify-between p-8 text-white md:flex" style={{ background: "linear-gradient(150deg, #3f4a38 0%, #56634d 60%, #63725a 100%)" }}>
          <svg aria-hidden viewBox="0 0 32 32" className="h-10 w-10">
            <rect width="32" height="32" rx="9" fill="rgb(255 255 255 / 0.15)" />
            <path d="M16 7c-4.5 3.2-6 7.2-4.6 11.3M16 7c4.5 3.2 6 7.2 4.6 11.3M16 7v18M10 25h12" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <div>
            <p className="font-display text-3xl font-semibold leading-tight">Every enquiry,<br />answered.</p>
            <p className="mt-3 text-sm text-white/85">The phone agent qualifies each caller honestly. You see every call, and you make the final call on anything borderline.</p>
          </div>
        </div>
        <form method="post" action="/api/login" className="space-y-5 p-8 sm:p-10">
          <div>
            <p className="text-sm text-fg-3">Aangan Studio</p>
            <h1 className="font-display text-[28px] font-semibold leading-tight">Enquiry desk</h1>
          </div>
          <label className="block text-sm">
            <span className="font-medium">Team password</span>
            <input name="password" type="password" required autoFocus autoComplete="current-password"
              aria-invalid={error ? true : undefined} aria-describedby={error ? "login-error" : undefined}
              className={`${inputCls} mt-1.5 w-full`} />
          </label>
          {error && <p id="login-error" role="alert" className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">That password didn&apos;t match. Check with the founder for the current one.</p>}
          <button className={`${buttonPrimary} w-full`}>Open dashboard</button>
        </form>
      </div>
    </main>
  );
}
