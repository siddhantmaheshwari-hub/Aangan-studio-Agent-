// Machine auth only. The dashboard itself has no password (owner's decision, 10 Oct);
// these checks protect the routes other systems call: Vaani's webhook secret and CRON_SECRET.

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const header = req.headers.get("authorization") ?? "";
  return Boolean(secret && safeEqual(header, `Bearer ${secret}`));
}
