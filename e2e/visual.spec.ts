import { type Page } from "@playwright/test";
import { expect, listTitles, settled, swipe, test, topCard } from "./fixtures";

/**
 * Visual regression: one reference image per screen and format
 * (e2e/visual.spec.ts-snapshots/). A refactor must not move a pixel; an
 * intended change is accepted with `npm run test:e2e -- --update-snapshots`.
 */
const FORMATS = [
  { name: "se", width: 320, height: 568 },
  { name: "iphone", width: 390, height: 844 },
  { name: "paysage", width: 844, height: 390 },
  { name: "desktop", width: 1280, height: 800 },
];

/** Same clock and same draw on every run. */
async function freeze(page: Page) {
  await page.clock.setFixedTime(new Date("2026-10-27T21:07:00+01:00"));
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
}

/** Captures once the screen is final: data loaded, fonts in, no request left. */
async function shoot(page: Page, name: string) {
  await settled(page);
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
}

test.describe("rendu visuel", () => {
  test.beforeEach(async ({ app }) => {
    // Viewports are set by hand: one project is enough.
    test.skip(test.info().project.name !== "desktop");
    await freeze(app);
    await swipe(app, ["keep", "keep", "keep"]);
  });

  for (const format of FORMATS) {
    test(`écrans : ${format.name}`, async ({ app }) => {
      await app.setViewportSize(format);

      await app.goto("/");
      await shoot(app, `${format.name}-1-accueil`);
      await app.getByRole("button", { name: /^LA SOIRÉE/ }).click();
      await shoot(app, `${format.name}-2-la-soiree`);
      await app.getByRole("button", { name: /^LA SOIRÉE/ }).click();
      await app.getByRole("button", { name: "TIRER UN FILM" }).click();
      await shoot(app, `${format.name}-3-ticket`);

      await app.goto("/swipe");
      await expect(topCard(app)).toHaveText(
        "Le Fabuleux Destin d'Amélie Poulain",
      );
      await shoot(app, `${format.name}-4-swipe`);

      await app.goto("/list");
      await expect(listTitles(app)).toHaveCount(3);
      await shoot(app, `${format.name}-5-liste`);

      await app.context().clearCookies();
      await app.goto("/unlock");
      await shoot(app, `${format.name}-6-code`);
    });
  }
});
