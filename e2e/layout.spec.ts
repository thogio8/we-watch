import AxeBuilder from "@axe-core/playwright";
import { type Locator, type Page } from "@playwright/test";
import { emptyNameRefused, expect, swipe, test } from "./fixtures";

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

/** The group pill's panel, open; then its create form refusing an empty name. */
async function* groupPanel(page: Page) {
  await page.getByRole("button", { name: /^Groupe affiché/ }).click();
  await expect(page.getByRole("dialog", { name: "TES GROUPES" })).toBeVisible();
  yield `${page.url()} (panneau du groupe)`;
  await page.getByRole("button", { name: "+ CRÉER UN GROUPE" }).click();
  await page.getByRole("button", { name: "CRÉER LE GROUPE" }).click();
  await expect(page.getByText("UN NOM DE 1 À 30 CARACTÈRES")).toBeVisible();
  yield `${page.url()} (panneau, nom refusé)`;
}

/** The first group screen of a newcomer, then its form refusing an empty name. */
async function* firstGroup(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "CRÉER TON PREMIER GROUPE" }),
  ).toBeVisible();
  yield "/ (premier groupe)";
  await page.getByRole("button", { name: "CRÉER LE GROUPE" }).click();
  await expect(page.getByText("UN NOM DE 1 À 30 CARACTÈRES")).toBeVisible();
  yield "/ (premier groupe, nom refusé)";
}

/**
 * Every page, the group panel, then the sign-in one signed out (cookies
 * cleared): its home, then its signup form showing an error.
 */
async function* visitAll(page: Page) {
  for (const path of PAGES) {
    await page.goto(path);
    yield path;
  }
  yield* groupPanel(page);
  await page.context().clearCookies();
  await page.goto(SIGNIN);
  yield SIGNIN;
  await emptyNameRefused(page);
  yield `${SIGNIN} (formulaire refusé)`;
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
        await expectNoOverflow(app, path);
      }
    });

    test(`aucun défaut d'accessibilité grave (axe) : ${viewport.name}`, async ({
      app,
    }) => {
      await app.setViewportSize(viewport);
      for await (const path of visitAll(app)) {
        expect(await seriousViolations(app, path)).toEqual([]);
      }
    });
  }
});

test.describe("TIRER tient sur un écran", () => {
  test.beforeEach(async ({ app }) => {
    test.skip(test.info().project.name !== "desktop");
    await swipe(app, ["keep", "keep"]);
  });

  for (const viewport of VIEWPORTS.filter(({ name }) => name !== "iPad")) {
    test(`le bouton et l’heure, sans défiler ni passer sous la nav : ${viewport.name}`, async ({
      app,
    }) => {
      await app.setViewportSize(viewport);
      await app.goto("/");
      const clock = app.getByText(/^Il est \d/);
      await expect(clock).toBeVisible();
      const nav = await box(
        app.getByRole("navigation", { name: "Navigation principale" }),
      );
      // The nav sits at the bottom on phones, at the top on wide screens.
      const navAtBottom = nav.y > viewport.height / 2;
      const top = navAtBottom ? 0 : nav.y + nav.height;
      const bottom = navAtBottom ? nav.y : viewport.height;
      for (const [name, element] of [
        ["TIRER", app.getByRole("button", { name: "TIRER UN FILM" })],
        ["l’heure", clock],
      ] as const) {
        const { y, height } = await box(element);
        expect(y, `${name} commence sous la nav`).toBeGreaterThanOrEqual(top);
        expect(y + height, `${name} finit avant la nav`).toBeLessThanOrEqual(
          bottom,
        );
      }
    });
  }
});

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  expect(found).not.toBeNull();
  return found!;
}

test.describe("mise en page et accessibilité, sans groupe", () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== "desktop");
  });

  for (const viewport of VIEWPORTS) {
    test(`premier groupe : ${viewport.name}`, async ({ newcomer }) => {
      await newcomer.setViewportSize(viewport);
      for await (const path of firstGroup(newcomer)) {
        await expectNoOverflow(newcomer, path);
        expect(await seriousViolations(newcomer, path)).toEqual([]);
      }
    });
  }
});

async function expectNoOverflow(page: Page, path: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, `${path} déborde de ${overflow}px`).toBeLessThanOrEqual(0);
}

/** axe's serious and critical findings, contrast included. */
async function seriousViolations(page: Page, path: string) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${path} ${v.id}: ${v.help}`);
}
