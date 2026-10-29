import AxeBuilder from "@axe-core/playwright";
import { type Page } from "@playwright/test";
import { expect, swipe, test } from "./fixtures";

/** Formats from spec §12: small and large phones, sideways, tablet, desktop. */
const VIEWPORTS = [
  { name: "SE", width: 320, height: 568 },
  { name: "iPhone", width: 390, height: 844 },
  { name: "téléphone couché", width: 844, height: 390 },
  { name: "iPad", width: 768, height: 1024 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "desktop", width: 1920, height: 1080 },
];

const PAGES = ["/", "/swipe", "/list"];
const SIGNIN = "/connexion";

/** Every page, the sign-in one last and signed out (cookies cleared). */
async function* visitAll(page: Page) {
  for (const path of PAGES) {
    await page.goto(path);
    yield path;
  }
  await page.context().clearCookies();
  await page.goto(SIGNIN);
  yield SIGNIN;
}

test.describe("mise en page et accessibilité", () => {
  test.beforeEach(async ({ app }) => {
    // Viewports are set by hand: one project is enough.
    test.skip(test.info().project.name !== "desktop");
    await swipe(app, ["keep", "keep"]);
  });

  for (const viewport of VIEWPORTS) {
    test(`rien ne déborde en largeur : ${viewport.name}`, async ({ app }) => {
      await app.setViewportSize(viewport);
      for await (const path of visitAll(app)) {
        const overflow = await app.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(
          overflow,
          `${path} déborde de ${overflow}px`,
        ).toBeLessThanOrEqual(0);
      }
    });
  }

  test("aucun défaut d'accessibilité grave (axe)", async ({ app }) => {
    for await (const path of visitAll(app)) {
      const { violations } = await new AxeBuilder({ page: app }).analyze();
      const serious = violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => `${path} ${v.id}: ${v.help}`);
      expect(serious).toEqual([]);
    }
  });
});
