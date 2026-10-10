// Finds the chat the bot should alert, and saves TELEGRAM_CHAT_ID into .env.local.
//   1. Open Telegram, message the bot (or add it to the team group and say anything).
//   2. npm run telegram:setup            → lists chats and saves the only/most recent one
//   3. npm run telegram:setup -- --test  → also sends one test message to that chat
// Never prints the bot token.
import { readFileSync, writeFileSync } from "node:fs";

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const api = (method: string, body?: unknown) =>
  fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).then((r) => r.json() as Promise<{ ok: boolean; result?: unknown; description?: string }>);

async function main() {
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set in .env.local");
  const me = await api("getMe");
  if (!me.ok) throw new Error(`Bot token rejected: ${me.description}`);
  console.log(`Bot: @${(me.result as { username: string }).username}`);

  const updates = await api("getUpdates");
  type Chat = { id: number; type: string; title?: string; first_name?: string };
  const chats = new Map<number, Chat>();
  for (const u of (updates.result as Record<string, { chat?: Chat }>[]) ?? [])
    for (const key of ["message", "channel_post", "my_chat_member", "edited_message"]) {
      const chat = u[key]?.chat;
      if (chat) chats.set(chat.id, chat);
    }
  if (chats.size === 0) {
    console.log("No chats yet. Send the bot a message in Telegram (or add it to your team group and post anything), then run this again.");
    process.exitCode = 2;
    return;
  }
  console.log("Chats the bot can see:");
  for (const c of chats.values()) console.log(`  ${c.id}  ${c.type}  ${c.title ?? c.first_name ?? ""}`);

  // Prefer a group (the team) over a private chat; otherwise the most recent.
  const all = [...chats.values()];
  const chosen = all.find((c) => c.type === "group" || c.type === "supergroup") ?? all[all.length - 1];
  const env = readFileSync(".env.local", "utf8");
  writeFileSync(".env.local", /^TELEGRAM_CHAT_ID=.*$/m.test(env)
    ? env.replace(/^TELEGRAM_CHAT_ID=.*$/m, `TELEGRAM_CHAT_ID=${chosen.id}`)
    : `${env.trimEnd()}\nTELEGRAM_CHAT_ID=${chosen.id}\n`);
  console.log(`Saved TELEGRAM_CHAT_ID=${chosen.id} (${chosen.title ?? chosen.first_name ?? chosen.type}) to .env.local`);

  if (process.argv.includes("--test")) {
    const r = await api("sendMessage", {
      chat_id: chosen.id,
      text: "Aangan enquiry agent: Telegram fallback is connected. You'll only hear from me when an email to the team fails.",
    });
    console.log(r.ok ? "Test message delivered." : `Test message failed: ${r.description}`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
