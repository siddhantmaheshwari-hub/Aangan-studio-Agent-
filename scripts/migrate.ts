// Runs every migrations/*.sql file in order against DATABASE_URL (Neon or local). Safe to re-run.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { env } from "../lib/env";

async function main() {
  const url = env().databaseUrl;
  if (!url) throw new Error("DATABASE_URL is missing or still a placeholder in .env.local");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const dir = path.join(process.cwd(), "migrations");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    await client.query(readFileSync(path.join(dir, f), "utf8"));
    console.log(`applied ${f}`);
  }
  await client.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
