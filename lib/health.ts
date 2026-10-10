// Health checks shown in the dashboard strip and used for alerts.
import { getStore, getVaani } from "./deps";
import { env } from "./env";

export interface Health {
  neon: { ok: boolean; detail: string };
  vaani: { ok: boolean; detail: string };
  lastSyncOk: string | null;
  lastSyncError: string | null;
}

export async function checkHealth(): Promise<Health> {
  const e = env();
  let neon = { ok: false, detail: "DATABASE_URL not set" };
  let lastSyncOk: string | null = null;
  let lastSyncError: string | null = null;
  if (e.databaseUrl) {
    try {
      const store = getStore(e);
      await store.ping();
      neon = { ok: true, detail: "connected" };
      lastSyncOk = await store.getState("last_sync_ok");
      lastSyncError = await store.getState("last_sync_error");
    } catch (err) {
      neon = { ok: false, detail: (err as Error).message.slice(0, 120) };
    }
  }
  const vaani = e.vaaniApiKey ? await getVaani(e).health() : { ok: false, detail: "VAANI_API_KEY not set" };
  return { neon, vaani, lastSyncOk, lastSyncError };
}
