// Dashboard login (one shared password) and machine auth (CRON_SECRET bearer).
// Uses Web Crypto so it runs in middleware too.

export const SESSION_COOKIE = "aangan_session";

async function hmacHex(key: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Session token: derived from the password, so changing the password logs everyone out. */
export async function sessionToken(): Promise<string | null> {
  const pw = process.env.DASHBOARD_PASSWORD?.trim();
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  if (!pw) return null;
  return hmacHex(`${pw}:${secret}`, "aangan-dashboard-v1");
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isValidSession(cookieValue: string | undefined): Promise<boolean> {
  const t = await sessionToken();
  return Boolean(t && cookieValue && safeEqual(cookieValue, t));
}

export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const header = req.headers.get("authorization") ?? "";
  return Boolean(secret && safeEqual(header, `Bearer ${secret}`));
}
