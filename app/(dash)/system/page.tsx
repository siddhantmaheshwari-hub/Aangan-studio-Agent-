// System — what's connected, how a call flows, and the rules in force. Never shows secret values.
import { Card, PageHeader } from "@/components/ui";
import { env } from "@/lib/env";
import { checkHealth } from "@/lib/health";
import { DEFAULT_GEMINI_MODEL } from "@/lib/extract/gemini";
import { RULES } from "@/lib/rules";

function Row({ name, ok, detail }: { name: string; ok: boolean; detail: string }) {
  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="font-medium text-fg">{name}</p>
        <p className="text-sm text-fg-2">{detail}</p>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ok ? "bg-ok-bg text-ok" : "bg-warn-bg text-warn"}`}>{ok ? "Connected" : "Not set up"}</span>
    </li>
  );
}

const STEPS = [
  ["Caller rings", "Vaani's AI agent answers, asks the questions, books FIT callers on Cal.com — and never quotes a price."],
  ["Call ends", "Vaani sends the finished call to this app (webhook). The raw call is saved first, so nothing is lost."],
  ["AI reads it", "Gemini pulls out the facts with the caller's own words. It does not decide anything."],
  ["Rules decide", "Fixed rules in code set the status. Borderline cases come to you; nothing borderline is declined."],
  ["Team is told", "Qualified → HubSpot deal + email + Telegram. Complaint → urgent email + Telegram, never a sales deal."],
];

export default async function SystemPage() {
  const e = env();
  const h = await checkHealth();
  return (
    <div>
      <PageHeader title="System" sub="What's connected and how each call is handled. Secret keys are never shown here." />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Connections">
          <ul className="-my-3 divide-y divide-line">
            <Row name="Database (Neon)" ok={h.neon.ok} detail={h.neon.ok ? "Stores every call, decision and delivery." : h.neon.detail} />
            <Row name="Vaani voice agent" ok={h.vaani.ok && Boolean(e.vaaniAgentId)} detail={e.vaaniAgentId ? "Agent “Aangan Studio Enquiries”. Calls arrive by webhook." : "No agent id set."} />
            <Row name="Gemini" ok={Boolean(e.geminiApiKey)} detail={`Model ${e.geminiModel ?? DEFAULT_GEMINI_MODEL}. Reads calls; never decides status.`} />
            <Row name="HubSpot" ok={Boolean(e.hubspotToken && e.hubspotPipelineId)} detail="Qualified leads → contact + deal in “Aangan Enquiries”." />
            <Row name="Email (Resend)" ok={Boolean(e.resendApiKey && e.founderEmail)} detail={e.handoffTo && e.handoffTo !== e.founderEmail ? "Handoffs to the team inbox; alerts to the founder." : "All emails go to the founder's address for now (no verified domain)."} />
            <Row name="Telegram" ok={Boolean(e.telegramToken && e.telegramChatId)} detail={e.telegramMode === "always" ? "Sent alongside every email." : "Used only when an email fails."} />
          </ul>
        </Card>

        <Card title="How a call is handled">
          <ol className="space-y-4">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="flex gap-3.5">
                <span aria-hidden className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sage-soft text-sm font-semibold text-sage-deep">{i + 1}</span>
                <div><p className="font-medium text-fg">{t}</p><p className="text-sm text-fg-2">{d}</p></div>
              </li>
            ))}
          </ol>
        </Card>

        <Card title="Qualification rules" aside="From Nikhil's qualified.md and services.md" className="lg:col-span-2">
          <ul className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            {Object.entries(RULES).map(([id, text]) => (
              <li key={id} className="flex gap-3"><span className="w-24 shrink-0 font-mono text-xs leading-5 text-fg-3">{id}</span><span className="text-fg-2">{text}</span></li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-fg-3">When several rules fire, the strongest wins: escalation › missed › not a fit › needs review › incomplete › qualified.</p>
        </Card>
      </div>
    </div>
  );
}
