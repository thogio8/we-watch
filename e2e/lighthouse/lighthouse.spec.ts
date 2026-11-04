import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import type { BrowserContext } from "@playwright/test";
import type { Flags, RunnerResult } from "lighthouse";
import { LIGHTHOUSE_PORT } from "../env";
import { expect, swipe, test } from "../fixtures";

/** Below these scores (0 to 1), the run fails. */
const MIN_ACCESSIBILITY = 1;
const MIN_BEST_PRACTICES = 0.9;
const MIN_PERFORMANCE = 0.8;

const THRESHOLDS = {
  performance: MIN_PERFORMANCE,
  accessibility: MIN_ACCESSIBILITY,
  "best-practices": MIN_BEST_PRACTICES,
} as const;
type Category = keyof typeof THRESHOLDS;
const CATEGORIES = Object.keys(THRESHOLDS) as Category[];

const REPORT_DIR = "lighthouse-report";

type Measure = { path: string; scores: Record<Category, number> };

/**
 * Lighthouse (its default mobile profile) on `path`, in the Chromium the
 * test runs, through its debugging port. Lighthouse opens its own tab,
 * outside Playwright's context: the session goes as a Cookie header.
 */
async function measure(
  baseURL: string,
  path: string,
  cookie?: string,
): Promise<Measure> {
  const { default: lighthouse } = await import("lighthouse");
  const flags: Flags = {
    port: LIGHTHOUSE_PORT,
    output: "html",
    logLevel: "error",
    formFactor: "mobile",
    onlyCategories: [...CATEGORIES],
    extraHeaders: cookie ? { Cookie: cookie } : null,
  };
  const url = `${baseURL}${path}`;
  const result = (await lighthouse(url, flags)) as RunnerResult;
  // Not redirected to /connexion: the session went through.
  expect(result.lhr.finalDisplayedUrl).toBe(url);
  const name = path === "/" ? "accueil" : path.slice(1);
  writeFileSync(`${REPORT_DIR}/${name}.html`, result.report as string);
  const scores = Object.fromEntries(
    CATEGORIES.map((id) => [id, result.lhr.categories[id]?.score ?? 0]),
  ) as Record<Category, number>;
  logFailingAudits(path, result);
  return { path, scores };
}

/** The audits that cost points, to tell what to fix. */
function logFailingAudits(path: string, { lhr }: RunnerResult) {
  const failing = CATEGORIES.flatMap(
    (id) => lhr.categories[id]?.auditRefs ?? [],
  )
    .filter(({ weight }) => weight > 0)
    .map(({ id }) => lhr.audits[id]!)
    .filter(({ score }) => score !== null && score < 0.9);
  for (const audit of failing) {
    const value = audit.displayValue ? ` (${audit.displayValue})` : "";
    console.log(`${path} ${audit.id}: ${audit.title}${value}`);
  }
}

/** The browser's cookies for the app, as a Cookie header. */
async function cookieHeader(context: BrowserContext, baseURL: string) {
  const cookies = await context.cookies(baseURL);
  return cookies.map(({ name, value }) => `${name}=${value}`).join("; ");
}

/** A markdown table of the scores, for GitHub's job summary. */
function summary(measures: Measure[]) {
  const percent = (score: number) => Math.round(score * 100);
  return [
    "### Lighthouse (mobile)",
    "",
    `| Page | ${CATEGORIES.join(" | ")} |`,
    `| --- | ${CATEGORIES.map(() => "---").join(" | ")} |`,
    ...measures.map(
      ({ path, scores }) =>
        `| \`${path}\` | ${CATEGORIES.map((id) => percent(scores[id])).join(" | ")} |`,
    ),
    "",
  ].join("\n");
}

test("les écrans tiennent les seuils Lighthouse", async ({ app, baseURL }) => {
  test.setTimeout(5 * 60_000);
  mkdirSync(REPORT_DIR, { recursive: true });
  const origin = baseURL!;
  const measures = [await measure(origin, "/connexion")];

  await swipe(app, ["keep", "keep", "reject", "keep"]);
  const cookie = await cookieHeader(app.context(), origin);
  for (const path of ["/", "/swipe", "/list"]) {
    measures.push(await measure(origin, path, cookie));
  }

  const table = summary(measures);
  console.log(table);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, table);
  }
  for (const { path, scores } of measures) {
    for (const id of CATEGORIES) {
      expect
        .soft(scores[id], `${path} ${id}`)
        .toBeGreaterThanOrEqual(THRESHOLDS[id]);
    }
  }
});
