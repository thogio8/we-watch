import { NextResponse, type NextRequest } from "next/server";
import { accessDecision, type AccessDecision } from "@/access/decision";
import { SIGNIN_PATH } from "@/access/paths";
import { readSignedIn } from "@/access/signed-in";
import { getServerEnv } from "@/env";
import { getAuth } from "@/server/container";

function respond(decision: AccessDecision, request: NextRequest) {
  switch (decision) {
    case "allow":
      return NextResponse.next();
    case "redirect":
      return NextResponse.redirect(new URL(SIGNIN_PATH, request.url));
    case "unauthorized":
      return new NextResponse(null, { status: 401 });
  }
}

/** Every request needs a Better Auth session (see src/access). */
export async function proxy(request: NextRequest) {
  const env = getServerEnv();
  const { signedIn, setCookies } = await readSignedIn(() =>
    getAuth().api.getSession({
      headers: request.headers,
      returnHeaders: true,
    }),
  );
  const response = respond(
    accessDecision({
      pathname: request.nextUrl.pathname,
      method: request.method,
      signedIn,
      authorization: request.headers.get("authorization"),
      cronSecret: env.CRON_SECRET,
    }),
    request,
  );
  // A refreshed session cache or expiry must reach the browser, or every
  // request after five minutes would read the database again.
  for (const cookie of setCookies) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
}
