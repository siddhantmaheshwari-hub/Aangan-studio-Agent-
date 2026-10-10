"use client";
// The founder's review gate. Shows exactly what a decision will trigger before it is saved,
// and asks for explicit confirmation when it sends something outside the dashboard.
import { useState } from "react";

interface Props {
  callId: number;
  current: string;
  rulesStatus: string;
  overridden: boolean;
  live: boolean;
  hasDeal: boolean;
  handoffSent: boolean;
  escalationSent: boolean;
  statuses: { value: string; label: string; help: string }[];
}

function consequences(choice: string, p: Props): { outbound: string[]; notes: string[] } {
  const target = choice === "clear" ? p.rulesStatus : choice;
  const outbound: string[] = [];
  const notes: string[] = [];
  if (!p.live) notes.push("Fixture replay: nothing is sent, only the status changes.");
  else if (target === "qualified") {
    if (!p.hasDeal) outbound.push("Create a HubSpot contact and deal");
    if (!p.handoffSent) outbound.push("Email the handoff to the team");
    if (p.hasDeal && p.handoffSent) notes.push("Deal and handoff already exist — nothing new is sent.");
  } else if (target === "escalation") {
    if (!p.escalationSent) outbound.push("Send the urgent escalation email");
  } else {
    notes.push("Nothing is sent. Only the status on the dashboard changes.");
    if (p.hasDeal) notes.push("The existing HubSpot deal is not deleted — move or close it in HubSpot.");
  }
  return { outbound, notes };
}

export function DecisionForm(p: Props) {
  const [choice, setChoice] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const { outbound, notes } = choice ? consequences(choice, p) : { outbound: [], notes: [] };
  const needsReason = choice !== "clear";
  const ready = choice && (!needsReason || reason.trim().length >= 3) && (outbound.length === 0 || confirmed);
  const options = p.statuses.filter((s) => s.value !== p.current);

  return (
    <form method="post" action={`/api/calls/${p.callId}/override`} className="space-y-3 text-sm">
      <fieldset>
        <legend className="mb-1 font-medium">Your decision</legend>
        <div className="flex flex-wrap gap-2">
          {options.map((s) => (
            <label key={s.value} title={s.help}
              className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md border px-3 ${choice === s.value ? "border-accent bg-surface-2 font-medium" : "border-line bg-surface hover:bg-surface-2"}`}>
              <input type="radio" name="status" value={s.value} checked={choice === s.value}
                onChange={() => { setChoice(s.value); setConfirmed(false); }} className="accent-[var(--accent)]" />
              {s.label}
            </label>
          ))}
          {p.overridden && (
            <label className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md border px-3 ${choice === "clear" ? "border-accent bg-surface-2 font-medium" : "border-line bg-surface hover:bg-surface-2"}`}>
              <input type="radio" name="status" value="clear" checked={choice === "clear"} onChange={() => { setChoice("clear"); setConfirmed(false); }} className="accent-[var(--accent)]" />
              Undo my decision (back to the rules)
            </label>
          )}
        </div>
      </fieldset>

      {choice && (
        <>
          {needsReason && (
            <label className="block">
              <span className="font-medium">Reason</span> <span className="text-fg-3">(kept in the audit log)</span>
              <textarea name="reason" required minLength={3} rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder={choice === "qualified" ? "e.g. Hinjewadi Phase 1 is close to Wakad; we can take it" : "e.g. Called back — project is in Talegaon, too far"}
                className="mt-1 w-full rounded-md border border-line bg-surface p-2 text-fg" />
            </label>
          )}

          <div role="status" className="rounded-md bg-surface-2 p-3">
            <p className="font-medium">What happens when you save</p>
            <ul className="mt-1 list-disc pl-5 text-fg-2">
              {outbound.map((o) => <li key={o}><b className="text-fg">{o}</b></li>)}
              {notes.map((n) => <li key={n}>{n}</li>)}
            </ul>
          </div>

          {outbound.length > 0 && (
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 accent-[var(--accent)]" />
              <span>I understand this sends the above and can&apos;t be unsent.</span>
            </label>
          )}

          <button disabled={!ready}
            className="inline-flex min-h-9 items-center rounded-md bg-accent px-4 font-medium text-accent-fg hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
            {outbound.length ? "Save decision and send" : "Save decision"}
          </button>
        </>
      )}
    </form>
  );
}
