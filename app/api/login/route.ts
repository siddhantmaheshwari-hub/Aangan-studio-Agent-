import { NextResponse } from "next/server";
import { safeEqual, SESSION_COOKIE, sessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const expected = process.env.DASHBOARD_PASSWORD?.trim();
  const url = new URL(req.url);
  if (!expected || !safeEqual(password, expected)) {
    return NextResponse.redirect(new URL("/login?error=1", url), 303);
  }
  const res = NextResponse.redirect(new URL("/", url), 303);
  res.cookies.set(SESSION_COOKIE, (await sessionToken())!, {
    httpOnly: true, secure: url.protocol === "https:", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
