import { NextResponse, type NextRequest } from "next/server";
import { decideAccess } from "@/access/decision";
import { SIGNIN_PATH } from "@/access/paths";
import { readSignedIn } from "@/access/signed-in";
import { getServerEnv } from "@/env";
import { getAuth } from "@/server/container";

/**
 * Every request needs a Better Auth session (see src/access). Cookies Better
 * Auth refreshes while reading it reach the browser through nextCookies():
 * the proxy runs with a writable cookies() store.
 */
export async function proxy(request: NextRequest) {
  const decision = await decideAccess(
    {
      pathname: request.nextUrl.pathname,
      method: request.method,
      authorization: request.headers.get("authorization"),
      cronSecret: getServerEnv().CRON_SECRET,
    },
    () =>
      readSignedIn(() =>
        getAuth().api.getSession({ headers: request.headers }),
      ),
  );
  switch (decision) {
    case "allow":
      return NextResponse.next();
    case "redirect":
      return NextResponse.redirect(new URL(SIGNIN_PATH, request.url));
    case "unauthorized":
      return new NextResponse(null, { status: 401 });
  }
}
