// Navigation timings as you feel them on a phone, on any deployment.
// Read-only: opens pages and comes back, never changes the list.
// Usage: ACCESS_CODE=… node scripts/measure-nav.mjs https://your-deployment
import { chromium } from "@playwright/test";

const BASE = process.argv[2];
if (!BASE) {
  console.error("Usage: ACCESS_CODE=… node scripts/measure-nav.mjs <url>");
  process.exit(1);
}
const ROUNDS = 3;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
let requests = 0;
page.on("request", (r) => {
  if (r.url().includes("_rsc")) requests += 1;
});

/**
 * Times an action until `target` (a CSS selector, or text when it starts
 * with "text=") is visible, checked in the page on every frame: Playwright's own
 * waits poll ever more slowly and would round everything up to ~800 ms.
 */
async function timed(action, target) {
  requests = 0;
  const shown = page.evaluate((what) => {
    // Next keeps visited pages in the DOM, hidden: only a visible one counts.
    const visible = (el) =>
      el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    const found = () =>
      what.startsWith("text=")
        ? [...document.querySelectorAll("body *")].some(
            (el) =>
              el.children.length === 0 &&
              el.textContent.includes(what.slice(5)) &&
              visible(el),
          )
        : [...document.querySelectorAll(what)].some(visible);
    const start = performance.now();
    return new Promise((resolve) => {
      const check = () =>
        found()
          ? resolve(performance.now() - start)
          : requestAnimationFrame(check);
      check();
    });
  }, target);
  await action();
  return { ms: Math.round(await shown), requests };
}

await page.goto(`${BASE}/unlock`);
await page.getByLabel("Code d'accès").fill(process.env.ACCESS_CODE ?? "");
await page.getByRole("button", { name: "ENTRER" }).click();
await page.waitForURL(`${BASE}/`);
await page.goto(`${BASE}/list`);
await page.locator("[role=tabpanel] li").first().waitFor();
const rows = page.getByRole("tabpanel").getByRole("link");
const LIST = "[role=tabpanel] li";
const tab = (name) => page.getByRole("link", { name, exact: true });

const results = {
  "liste → fiche": [],
  "fiche → liste": [],
  "onglet TIRER": [],
  "onglet LISTE": [],
};
for (let i = 0; i < ROUNDS; i++) {
  results["liste → fiche"].push(
    await timed(() => rows.nth(i).click(), "text=CHEZ NOUS"),
  );
  results["fiche → liste"].push(
    await timed(
      () => page.getByRole("link", { name: "← LA LISTE" }).click(),
      LIST,
    ),
  );
  results["onglet TIRER"].push(
    await timed(() => tab("TIRER").click(), "text=à regarder"),
  );
  results["onglet LISTE"].push(await timed(() => tab("LISTE").click(), LIST));
}
await browser.close();

console.log(`${BASE}  (${ROUNDS} passages, ms · requêtes serveur)`);
for (const [name, runs] of Object.entries(results)) {
  const cells = runs.map(
    (r) => `${String(r.ms).padStart(4)} ms · ${r.requests}`,
  );
  console.log(`${name.padEnd(14)} ${cells.join("   ")}`);
}
