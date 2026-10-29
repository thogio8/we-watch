// Navigation timings as you feel them on a phone, on any deployment.
// Read-only: opens pages and comes back, never changes the list.
// Usage: SESSION_TOKEN=… node scripts/measure-nav.mjs https://your-deployment
// A headless browser has no Face ID: sign in on that deployment in your own
// browser, then copy the value of the `better-auth.session_token` cookie
// (`__Secure-better-auth.session_token` over https) from the developer tools.
// The value is a secret: it is only handed to the browser, never printed.
import { chromium } from "@playwright/test";

const USAGE = "Usage: SESSION_TOKEN=… node scripts/measure-nav.mjs <url>";
const BASE = process.argv[2];
const TOKEN = process.env.SESSION_TOKEN;
if (!BASE || !TOKEN) {
  console.error(USAGE);
  process.exit(1);
}
const ROUNDS = 3;

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
const secure = new URL(BASE).protocol === "https:";
await context.addCookies([
  {
    name: `${secure ? "__Secure-" : ""}better-auth.session_token`,
    value: TOKEN,
    url: BASE,
    httpOnly: true,
    secure,
    sameSite: "Lax",
  },
]);
const page = await context.newPage();
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

await page.goto(`${BASE}/list`);
if (new URL(page.url()).pathname === "/connexion") {
  console.error("✕ The session was refused: copy a fresh SESSION_TOKEN.");
  await browser.close();
  process.exit(1);
}
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
