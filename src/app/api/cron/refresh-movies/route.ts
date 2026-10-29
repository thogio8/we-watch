import { isCronAuthorized } from "@/access/cron";
import { getServerEnv } from "@/env";
import { refreshMovies } from "@/features/refresh/refresh-movies";
import { getRefreshDeps } from "@/server/container";

/**
 * Daily refresh of every « à voir » and « vu » movie of every group, once per
 * movie however many groups list it (shared snapshot, spec §11.2), triggered
 * by Vercel Cron (vercel.json). The proxy already checks the secret; checked
 * again here in case the route is ever reached another way.
 *
 * The report goes to the Vercel logs. When every movie fails (TMDB down, token
 * expired), the route answers 500 so the cron run shows as failed.
 */
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!isCronAuthorized(authorization, getServerEnv().CRON_SECRET)) {
    return new Response(null, { status: 401 });
  }
  const report = await refreshMovies(getRefreshDeps());
  const allFailed = report.total > 0 && report.failed.length === report.total;
  if (allFailed) {
    console.error("refresh-movies: every movie failed", report);
  } else if (report.failed.length > 0) {
    console.warn("refresh-movies: some movies failed", report);
  } else {
    console.info("refresh-movies: done", report);
  }
  return Response.json(report, { status: allFailed ? 500 : 200 });
}
