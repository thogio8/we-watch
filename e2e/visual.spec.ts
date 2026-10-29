import { type Page } from "@playwright/test";
import {
  decidedOn,
  emptyNameRefused,
  expect,
  listTitles,
  settled,
  swipe,
  test,
  topCard,
  UNSUPPORTED_MESSAGE,
  withoutPasskeys,
} from "./fixtures";

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

const FROZEN_NOW = new Date("2026-10-27T21:07:00+01:00");

/** Same clock and same draw on every run. */
async function freeze(page: Page) {
  await page.clock.setFixedTime(FROZEN_NOW);
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
}

/**
 * Captures once the screen is final: data loaded, fonts in, no request left.
 * In a fullPage capture the fixed bottom nav sits where the first viewport
 * ends, so it may cover content in the image only (the shell pads for it).
 */
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
    // The fiche shows « Ajouté le … », stamped by the server.
    await decidedOn(FROZEN_NOW);
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

      await app.goto("/list/496243");
      await expect(app.getByText("Bong Joon-ho")).toBeVisible();
      await shoot(app, `${format.name}-5b-fiche`);

      // Signed out: the sign-in page, as a newcomer sees it.
      await app.context().clearCookies();
      await app.goto("/connexion");
      await expect(
        app.getByRole("button", { name: "SE CONNECTER" }),
      ).toBeVisible();
      await shoot(app, `${format.name}-6-connexion`);
      await emptyNameRefused(app);
      await shoot(app, `${format.name}-6b-connexion-erreur`);

      // A browser without passkeys: the explanation instead of the buttons.
      await withoutPasskeys(app);
      await app.goto("/connexion");
      await expect(app.getByText(UNSUPPORTED_MESSAGE)).toBeVisible();
      await shoot(app, `${format.name}-6c-connexion-sans-cle`);
    });
  }
});
