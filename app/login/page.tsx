export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form method="post" action="/api/login" className="w-full max-w-sm space-y-4 rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold">Aangan Studio — enquiries</h1>
        <label className="block text-sm">
          <span className="text-stone-600">Dashboard password</span>
          <input name="password" type="password" required autoFocus className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2" />
        </label>
        {error && <p className="text-sm text-red-700">Wrong password.</p>}
        <button className="w-full rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-700">Log in</button>
      </form>
    </main>
  );
}
