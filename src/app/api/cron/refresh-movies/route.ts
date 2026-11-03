import { isCronAuthorized } from "@/access/cron";
import { getServerEnv } from "@/env";
import { refreshMovies } from "@/features/refresh/refresh-movies";
import { getHousekeeping, getRefreshDeps } from "@/server/container";

/**
 * Daily housekeeping (expired auth rows, old attempt counters), then refresh
 * of every « à voir » and « vu » movie of every group, once per movie however
 * many groups list it (shared snapshot, spec §11.2), triggered by Vercel Cron
 * (vercel.json). The proxy already checks the secret; checked again here in
 * case the route is ever reached another way.
 *
 * A failing purge throws (Next answers 500): a broken database must fail the
 * cron run and the smoke test. The report goes to the Vercel logs. When every
 * movie fails (TMDB down, token expired), the route answers 500 so the cron
 * run shows as failed.
 */
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!isCronAuthorized(authorization, getServerEnv().CRON_SECRET)) {
    return new Response(null, { status: 401 });
  }
  const purged = await getHousekeeping().purge();
  const report = { ...(await refreshMovies(getRefreshDeps())), purged };
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
