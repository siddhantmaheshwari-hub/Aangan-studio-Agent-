// One query function for the whole app. Neon's HTTP driver in production; a plain Postgres
// connection when DATABASE_URL points at localhost (local dev with `npm run db:local`).
import { neon } from "@neondatabase/serverless";

export type Row = Record<string, unknown>;
export interface Db {
  query(text: string, params?: unknown[]): Promise<Row[]>;
  /** Runs the statements in one transaction. */
  transaction(statements: { text: string; params?: unknown[] }[]): Promise<void>;
}

const isLocal = (url: string) => /@(localhost|127\.0\.0\.1)[:/]/.test(url);

function neonDb(url: string): Db {
  const sql = neon(url);
  return {
    query: async (text, params = []) => (await sql.query(text, params)) as Row[],
    transaction: async (stmts) => {
      await sql.transaction(stmts.map((s) => sql.query(s.text, s.params ?? [])));
    },
  };
}

function localDb(url: string): Db {
  // Loaded lazily so production bundles never need it.
  const poolPromise = import("pg").then(({ default: pg }) => {
    const pool = new pg.Pool({ connectionString: url, max: 1, idleTimeoutMillis: 5_000 });
    pool.on("error", () => {}); // an idle connection dropped by the local server; the next query reconnects
    return pool;
  });
  const dropped = (err: unknown) => /ECONNRESET|Connection terminated/i.test(String((err as Error)?.message));
  return {
    query: async (text, params = []) => {
      const pool = await poolPromise;
      try {
        return (await pool.query(text, params)).rows;
      } catch (err) {
        if (!dropped(err)) throw err;
        return (await pool.query(text, params)).rows; // one retry on a fresh connection
      }
    },
    transaction: async (stmts) => {
      const client = await (await poolPromise).connect();
      try {
        await client.query("begin");
        for (const s of stmts) await client.query(s.text, s.params ?? []);
        await client.query("commit");
      } catch (err) {
        await client.query("rollback");
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

const cache = new Map<string, Db>();

export function getDb(url: string): Db {
  let db = cache.get(url);
  if (!db) {
    db = isLocal(url) ? localDb(url) : neonDb(url);
    cache.set(url, db);
  }
  return db;
}
