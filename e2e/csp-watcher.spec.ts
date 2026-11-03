import { watchSecurity } from "./csp";
import { expect, test } from "./fixtures";

// The watcher is what makes every other spec sensitive to a CSP violation:
// prove it still records one, so a browser change cannot disable it silently.
test("le guetteur de CSP signale une ressource d'une origine non autorisée", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ baseURL });
  const check = await watchSecurity(context);
  const page = await context.newPage();
  await page.goto("/connexion");

  await page.evaluate(() => {
    const image = document.createElement("img");
    image.src = "https://not-allowed.example.invalid/poster.jpg";
    document.body.append(image);
  });

  await expect
    .poll(() => {
      try {
        check();
        return "silence";
      } catch (error) {
        return String(error);
      }
    })
    .toContain("CSP violation");
  await context.close();
});
