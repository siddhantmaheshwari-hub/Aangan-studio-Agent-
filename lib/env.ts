// Reads configuration from process.env. Never log these values.

const s = (k: string) => {
  const v = process.env[k]?.trim();
  return v && !v.includes("PASTE_") ? v : undefined;
};
const n = (k: string) => {
  const v = s(k);
  return v !== undefined && !isNaN(Number(v)) ? Number(v) : null;
};

export function env() {
  return {
    databaseUrl: s("DATABASE_URL"),
    geminiApiKey: s("GEMINI_API_KEY"),
    geminiModel: s("GEMINI_MODEL"),
    vaaniApiKey: s("VAANI_API_KEY"),
    vaaniAgentId: s("VAANI_AGENT_ID"),
    vaaniBaseUrl: s("VAANI_BASE_URL") ?? "https://api.vaanivoice.ai",
    vaaniWebhookSecret: s("VAANI_WEBHOOK_SECRET"),
    hubspotToken: s("HUBSPOT_TOKEN"),
    hubspotPipelineId: s("HUBSPOT_PIPELINE_ID"),
    calComEventUrl: s("CAL_COM_EVENT_URL"),
    resendApiKey: s("RESEND_API_KEY"),
    resendFrom: s("RESEND_FROM"),
    handoffTo: s("HANDOFF_TO_EMAIL"),
    escalationTo: s("ESCALATION_TO_EMAIL"),
    founderEmail: s("FOUNDER_EMAIL"),
    telegramToken: s("TELEGRAM_BOT_TOKEN"),
    telegramChatId: s("TELEGRAM_CHAT_ID"),
    telegramMode: (s("TELEGRAM_MODE") === "fallback" ? "fallback" : "always") as "always" | "fallback",
    dashboardPassword: s("DASHBOARD_PASSWORD"),
    cronSecret: s("CRON_SECRET"),
    appUrl: s("APP_URL") ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null),
    budgetFloorInr: n("APPROVED_BUDGET_FLOOR_INR"),
    vaaniCostPerMinInr: n("VAANI_COST_PER_MIN_INR"),
    geminiInPer1M: n("GEMINI_COST_PER_1M_INPUT_TOKENS_INR"),
    geminiOutPer1M: n("GEMINI_COST_PER_1M_OUTPUT_TOKENS_INR"),
  };
}

export type Env = ReturnType<typeof env>;
