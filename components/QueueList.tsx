// "Needs your decision" items — used on the overview (top few) and the Review queue page (all).
import Link from "next/link";
import { ruleTitle } from "@/lib/labels";
import type { QueueItem } from "@/lib/queries";
import { ago, Flag } from "./ui";

export const QUEUE_KIND: Record<QueueItem["kind"], { label: string; cls: string; action: string }> = {
  escalation: { label: "Escalation", cls: "bg-danger-bg text-danger", action: "Call the client back" },
  not_delivered: { label: "Not delivered", cls: "bg-danger-bg text-danger", action: "Follow up by hand" },
  stuck: { label: "Processing failed", cls: "bg-warn-bg text-warn", action: "Open and retry" },
  needs_review: { label: "Needs review", cls: "bg-warn-bg text-warn", action: "Decide" },
  incomplete: { label: "Incomplete", cls: "bg-info-bg text-info", action: "Call back for details" },
};

function initials(name: string | null, phone: string | null) {
  if (name) return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return phone ? phone.slice(-2) : "?";
}

export function QueueList({ items }: { items: QueueItem[] }) {
  return (
    <ul className="-mx-2 divide-y divide-line">
      {items.map((q) => {
        const k = QUEUE_KIND[q.kind];
        return (
          <li key={`${q.kind}-${q.callId}`}>
            <Link href={`/calls/${q.callId}`} className="flex items-start gap-3.5 rounded-xl px-2 py-3.5 transition-colors duration-150 hover:bg-surface-2">
              <span aria-hidden className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 text-sm font-semibold text-fg-2">
                {initials(q.name, q.phone)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium text-fg">{q.name ?? q.phone ?? "Unknown caller"}</span>
                  {q.area && <span className="text-sm text-fg-3">· {q.area}</span>}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${k.cls}`}>{k.label}</span>
                </span>
                <span className="mt-0.5 block text-sm text-fg-2">
                  {q.detail ?? (q.ruleIds.length ? q.ruleIds.map(ruleTitle).join(" · ") : q.summary)}
                </span>
                {q.flags.includes("price_figure_spoken") && <span className="mt-1.5 block"><Flag name="price_figure_spoken" /></span>}
              </span>
              <span className="shrink-0 text-right text-xs text-fg-3">
                {ago(q.at)}
                <span className="mt-1.5 hidden font-semibold text-accent sm:block">{k.action} →</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
