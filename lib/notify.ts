// Notifications: Resend (one retry) and Telegram. Telegram mode "always" sends both channels;
// "fallback" sends Telegram only when email failed. Every attempt is recorded.
// "Sent" means a 2xx from the provider — nothing else.
import type { NotificationRow, Store } from "./store/types";

export interface SendResult {
  ok: boolean;
  providerId?: string | null;
  error?: string;
}

export interface Channels {
  email: { configured: boolean; send(to: string, subject: string, text: string): Promise<SendResult> };
  telegram: { configured: boolean; send(text: string): Promise<SendResult> };
  recipients: { handoff: string | null; escalation: string | null; founder: string | null };
  /** Default "fallback". Production sets it from TELEGRAM_MODE (default "always"). */
  telegramMode?: "always" | "fallback";
}

type Kind = NotificationRow["kind"];

const errText = async (res: Response) => `HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`;

export function resendChannel(apiKey: string | undefined, from: string | undefined): Channels["email"] {
  return {
    configured: Boolean(apiKey && from),
    async send(to, subject, text) {
      if (!apiKey || !from) return { ok: false, error: "Resend not configured (RESEND_API_KEY / RESEND_FROM)" };
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: [to], subject, text }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) return { ok: false, error: await errText(res) };
        const body = (await res.json().catch(() => ({}))) as { id?: string };
        return { ok: true, providerId: body.id ?? null };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    },
  };
}

export function telegramChannel(token: string | undefined, chatId: string | undefined): Channels["telegram"] {
  return {
    configured: Boolean(token && chatId),
    async send(text) {
      if (!token || !chatId) return { ok: false, error: "Telegram not configured" };
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000) }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) return { ok: false, error: await errText(res) };
        const body = (await res.json().catch(() => ({}))) as { result?: { message_id?: number } };
        return { ok: true, providerId: body.result?.message_id ? String(body.result.message_id) : null };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    },
  };
}

function recipientFor(kind: Kind, r: Channels["recipients"]) {
  if (kind === "handoff") return r.handoff ?? r.founder;
  if (kind === "escalation") return r.escalation ?? r.founder;
  return r.founder;
}

/**
 * Deliver one message. Returns true only if some provider returned 2xx.
 * On total failure writes a pipeline_errors row (the dashboard shows "not delivered").
 */
export async function deliver(
  store: Store,
  ch: Channels,
  msg: { kind: Kind; enquiryId: number | null; callId: number | null; subject: string; text: string },
): Promise<boolean> {
  const to = recipientFor(msg.kind, ch.recipients);
  const record = (channel: "resend" | "telegram", attempt: number, r: SendResult, recipient: string | null) =>
    store.addNotification({
      enquiry_id: msg.enquiryId, kind: msg.kind, channel, attempt, ok: r.ok,
      provider_id: r.providerId ?? null, recipient, error: r.ok ? null : r.error ?? "unknown error",
    });

  const errors: string[] = [];
  let emailOk = false;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const r = to ? await ch.email.send(to, msg.subject, msg.text) : { ok: false, error: "No recipient email configured" };
    await record("resend", attempt, r, to);
    if (r.ok) {
      emailOk = true;
      break;
    }
    errors.push(`resend#${attempt}: ${r.error}`);
    if (!ch.email.configured || !to) break; // retrying can't fix missing config
  }

  // "always": Telegram goes out alongside email. "fallback": only when email failed.
  let telegramOk = false;
  const sendTelegram = ch.telegram.configured && (ch.telegramMode === "always" || !emailOk);
  if (sendTelegram) {
    const r = await ch.telegram.send(`${msg.subject}\n\n${msg.text}`);
    await record("telegram", ch.telegramMode === "always" ? 1 : 3, r, "telegram");
    telegramOk = r.ok;
    if (!r.ok) errors.push(`telegram: ${r.error}`);
  }

  if (emailOk || telegramOk) {
    // Delivered somewhere, but a failed channel is still worth seeing on the dashboard.
    if (errors.length && ch.telegramMode === "always")
      await store.addPipelineError({ call_id: msg.callId, step: `notify:${msg.kind}`, message: `Partly delivered (${emailOk ? "email" : "Telegram"} only). ${errors.join(" | ")}` });
    return true;
  }
  await store.addPipelineError({ call_id: msg.callId, step: `notify:${msg.kind}`, message: `Not delivered. ${errors.join(" | ")}` });
  return false;
}
