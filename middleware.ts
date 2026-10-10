// Every page and API route needs the dashboard login, except the ones that check their own
// machine credentials (webhook secret / CRON_SECRET) and the login itself.
import { NextResponse, type NextRequest } from "next/server";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";

const PUBLIC = ["/login", "/api/login", "/api/vaani/webhook", "/api/sync", "/api/health", "/api/cron/"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || (p.endsWith("/") && pathname.startsWith(p)))) return NextResponse.next();
  if (await isValidSession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "login required" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
