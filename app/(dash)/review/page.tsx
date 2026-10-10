// Review queue — every enquiry waiting for a person, grouped by what kind of action it needs.
import Link from "next/link";
import { QUEUE_KIND, QueueList } from "@/components/QueueList";
import { SourceTabs } from "@/components/SourceTabs";
import { Card, PageHeader } from "@/components/ui";
import { actionQueue, type QueueItem } from "@/lib/queries";

const ORDER: QueueItem["kind"][] = ["escalation", "not_delivered", "stuck", "needs_review", "incomplete"];

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ source?: string; kind?: string }> }) {
  const { source = "live", kind } = await searchParams;
  const all = await actionQueue(source);
  const items = kind ? all.filter((i) => i.kind === kind) : all;
  const count = (k: string) => all.filter((i) => i.kind === k).length;

  return (
    <div>
      <PageHeader title="Review queue" sub="Borderline enquiries, complaints and anything that didn't go through. Your decision is final.">
        <SourceTabs source={source} base="/review" params={{ kind }} />
      </PageHeader>

      <nav aria-label="Filter by type" className="mb-5 flex flex-wrap gap-2 text-sm">
        <Link href={`/review?source=${source}`} aria-current={!kind ? "page" : undefined}
          className={`inline-flex min-h-9 items-center rounded-full border px-3.5 ${!kind ? "border-sage/40 bg-sage-soft font-semibold text-sage-deep" : "border-line bg-surface text-fg-2 hover:text-fg"}`}>
          All <span className="ml-1.5 tabular-nums text-fg-3">{all.length}</span>
        </Link>
        {ORDER.filter((k) => count(k) > 0).map((k) => (
          <Link key={k} href={`/review?source=${source}&kind=${k}`} aria-current={kind === k ? "page" : undefined}
            className={`inline-flex min-h-9 items-center rounded-full border px-3.5 ${kind === k ? "border-sage/40 bg-sage-soft font-semibold text-sage-deep" : "border-line bg-surface text-fg-2 hover:text-fg"}`}>
            {QUEUE_KIND[k].label} <span className="ml-1.5 tabular-nums text-fg-3">{count(k)}</span>
          </Link>
        ))}
      </nav>

      <Card>
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <span aria-hidden className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-sage-soft text-xl text-sage-deep">✓</span>
            <p className="font-display text-xl font-semibold">All clear</p>
            <p className="max-w-sm text-sm text-fg-2">Nothing is waiting for you. New borderline calls and complaints will show up here.</p>
          </div>
        ) : <QueueList items={items} />}
      </Card>
    </div>
  );
}
