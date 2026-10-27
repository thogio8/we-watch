import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/access/cookie";
import { accessDecision } from "@/access/decision";
import { UNLOCK_PATH } from "@/access/paths";
import { getServerEnv } from "@/env";

/** Shared access code: every request needs the unlock cookie (see src/access). */
export async function proxy(request: NextRequest) {
  const env = getServerEnv();
  const decision = await accessDecision({
    pathname: request.nextUrl.pathname,
    method: request.method,
    cookie: request.cookies.get(ACCESS_COOKIE)?.value,
    code: env.ACCESS_CODE,
    authorization: request.headers.get("authorization"),
    cronSecret: env.CRON_SECRET,
  });
  switch (decision) {
    case "allow":
      return NextResponse.next();
    case "redirect":
      return NextResponse.redirect(new URL(UNLOCK_PATH, request.url));
    case "unauthorized":
      return new NextResponse(null, { status: 401 });
  }
}
