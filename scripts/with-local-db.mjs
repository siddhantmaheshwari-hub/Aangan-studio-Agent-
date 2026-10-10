// Runs a command against the local dev database (started with `npm run db:local`),
// without touching .env.local. Example: node scripts/with-local-db.mjs npm run migrate
import { spawn } from "node:child_process";

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error("usage: node scripts/with-local-db.mjs <command> [args]");
  process.exit(1);
}
const env = { ...process.env, DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54329/postgres" };
const child = spawn(cmd, args, { stdio: "inherit", env, shell: process.platform === "win32" });
child.on("exit", (code) => process.exit(code ?? 1));
