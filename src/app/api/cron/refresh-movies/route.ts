import { isCronAuthorized } from "@/access/cron";
import { getServerEnv } from "@/env";
import { refreshMovies } from "@/features/refresh/refresh-movies";
import { getRefreshDeps } from "@/server/container";

/**
 * Daily refresh of every « à voir » and « vu » movie (spec §11.2), triggered
 * by Vercel Cron (vercel.json). The proxy already checks the secret; checked
 * again here in case the route is ever reached another way.
 */
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!isCronAuthorized(authorization, getServerEnv().CRON_SECRET)) {
    return new Response(null, { status: 401 });
  }
  const report = await refreshMovies(getRefreshDeps());
  return Response.json(report);
}
