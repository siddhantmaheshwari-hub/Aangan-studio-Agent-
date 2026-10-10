// Payload shapes copied from https://docs.vaanivoice.ai (call-history, call_details, transcript, webhook).
import { describe, expect, it } from "vitest";
import { callIdOf, isNotReady, isOurAgent, listFrom, parseTranscript, toIncomingCall } from "@/lib/vaani";

const historyRow = {
  call_id: "inbound-1790000000-abc",
  call_type: "Inbound",
  call_status: "User disconnected",
  agent_id: "7ec4155e-0e62-440a-b983-5974f7697854",
  from_number: "+919800000001",
  Start_time: "2026-10-10T06:30:00.000000",
  End_time: "2026-10-10T06:34:00.000000",
  duration_ms: 241_500,
  call_summary: "Caller wants a 3BHK in Kothrud redone.",
  post_processing_status: "completed",
  recording_api: "https://api.vaanivoice.ai/api/stream/inbound-1790000000-abc",
  call_metadata: {},
  chat_history: [],
};

const transcriptText =
  "AGENT: Hello, thank you for calling Aangan Studio.\n\n USER: Hi, I have a 3BHK in Kothrud.\n\n AGENT: Lovely. When would you like it finished?\n\n USER: By March,\nno rush.";

describe("Vaani mapping (documented shapes)", () => {
  it("reads the call-history envelope", () => {
    expect(listFrom({ data: [historyRow], pagination: { page: 1 } })).toHaveLength(1);
    expect(callIdOf(historyRow)).toBe("inbound-1790000000-abc");
  });

  it("parses AGENT:/USER: transcripts, timestamps and wrapped lines", () => {
    expect(parseTranscript(transcriptText)).toEqual([
      ["AGENT", "Hello, thank you for calling Aangan Studio."],
      ["USER", "Hi, I have a 3BHK in Kothrud."],
      ["AGENT", "Lovely. When would you like it finished?"],
      ["USER", "By March, no rush."],
    ]);
    expect(parseTranscript("[13:33:14] AGENT: Hi!\n\n[13:33:19] USER: Yeah.")).toEqual([["AGENT", "Hi!"], ["USER", "Yeah."]]);
    expect(parseTranscript({ transcript: "Transcript not found in Azure Blob Storage", status_code: 404 })).toEqual([]);
  });

  it("builds a call from history + details: ms duration, UTC start, caller number", () => {
    const call = toIncomingCall("inbound-1790000000-abc", {
      history: historyRow,
      details: { transcription: transcriptText, entity: {}, summary: "Kothrud 3BHK.", call_eval_tag: null },
      transcript: { transcript: transcriptText, status_code: 200 },
    });
    expect(call).toMatchObject({
      callerNumber: "+919800000001",
      startedAt: "2026-10-10T06:30:00.000Z",
      durationSec: 242,
      outcome: "completed",
      summaryVaani: "Kothrud 3BHK.",
    });
    expect(call.transcript).toHaveLength(4);
  });

  it("uses the webhook payload when history is unavailable", () => {
    const webhook = {
      event: "call_postprocessing",
      call_id: "web-1",
      timestamp: "2026-10-10T06:34:00+00:00",
      data: { call_id: "web-1", call_duration: 60_000, end_reason: "Call ended", summary: "s", transcript: "[06:33:00] AGENT: Hi\n\n[06:33:05] USER: Hello, Baner flat" },
    };
    expect(callIdOf(webhook)).toBe("web-1");
    const call = toIncomingCall("web-1", { webhook });
    expect(call).toMatchObject({ durationSec: 60, startedAt: "2026-10-10T06:33:00.000Z", callerNumber: null });
    expect(call.transcript).toHaveLength(2);
  });

  it("a call that dropped at once is disconnected; a normal hang-up is completed", () => {
    const dropped = toIncomingCall("d", { history: { ...historyRow, duration_ms: 9000 }, transcript: { transcript: "AGENT: Hello\n\n USER: Hi I wanted to—" } });
    expect(dropped.outcome).toBe("disconnected");
    const noAnswer = toIncomingCall("n", { history: { ...historyRow, call_status: "error", duration_ms: 0 } });
    expect(noAnswer.outcome).toBe("missed");
  });

  it("knows when Vaani is still post-processing", () => {
    expect(isNotReady({ history: { ...historyRow, post_processing_status: "processing" } })).toBe(true);
    expect(isNotReady({ details: { transcription: "Transcript is not available for further evaluations." } })).toBe(true);
    expect(isNotReady({ history: historyRow })).toBe(false);
  });

  it("filters by agent id", () => {
    expect(isOurAgent(historyRow, "7ec4155e-0e62-440a-b983-5974f7697854")).toBe(true);
    expect(isOurAgent(historyRow, "someone-else")).toBe(false);
    expect(isOurAgent(historyRow, undefined)).toBe(true);
  });
});

describe("real Vaani payload quirks (seen on the first live call)", () => {
  it("call_duration in seconds, pickup/end timestamps, test-call number in 'to'", () => {
    const webhook = {
      event: "call_postprocessing", call_id: "outbound-1", from: "+910000001272", to: "+910000000282", timestamp: "2026-10-10T15:30:30Z",
      data: { call_type: "outbound", phone_number: "+910000000282", call_duration: 229.91, call_started_at: "2026-10-10T15:26:18Z",
        picked_up_at: "2026-10-10T15:26:34Z", call_ended_at: "2026-10-10T15:30:26Z", transcript: "[15:26:42] AGENT: Hello\n\n[15:26:50] USER: Hi, 3BHK in Kothrud" },
    };
    expect(toIncomingCall("outbound-1", { webhook })).toMatchObject({ durationSec: 232, callerNumber: "+910000000282", startedAt: "2026-10-10T15:26:18.000Z" });
    const inbound = { ...webhook, data: { ...webhook.data, call_type: "inbound", call_ended_at: undefined, picked_up_at: undefined, call_started_at: undefined } };
    expect(toIncomingCall("in-1", { webhook: inbound })).toMatchObject({ durationSec: 230, callerNumber: "+910000001272" });
  });
});
