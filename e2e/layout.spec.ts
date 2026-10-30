import AxeBuilder from "@axe-core/playwright";
import { type Locator, type Page } from "@playwright/test";
import {
  emptyNameRefused,
  expect,
  leasInvitation,
  swipe,
  test,
} from "./fixtures";
import { COPY_LINK } from "./groups";

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

/** « MEMBRES ET INVITATION », then its leaving ticket. */
async function* members(page: Page) {
  await page.goto("/groupe");
  await expect(page.getByRole("button", { name: COPY_LINK })).toBeEnabled();
  yield "/groupe";
  await page.getByRole("button", { name: "QUITTER LE GROUPE" }).click();
  await expect(page.getByRole("group")).toBeVisible();
  yield "/groupe (quitter)";
}

/**
 * Every page, the group panel, the members screen, then signed out (cookies
 * cleared): an invite link, the sign-in home, its signup form showing an
 * error.
 */
async function* visitAll(page: Page) {
  for (const path of PAGES) {
    await page.goto(path);
    yield path;
  }
  yield* groupPanel(page);
  yield* members(page);
  await page.context().clearCookies();
  await page.goto(await leasInvitation());
  await expect(
    page.getByRole("button", { name: "CRÉER UN COMPTE" }),
  ).toBeVisible();
  yield "/invitation (déconnecté)";
  await page.goto(SIGNIN);
  yield SIGNIN;
  await emptyNameRefused(page);
  yield `${SIGNIN} (formulaire refusé)`;
}

type Viewport = { width: number; height: number };
type Devices = {
  app: Page;
  member: (name: string) => Promise<Page>;
  outsider: (name: string) => Promise<Page>;
};

/**
 * Léa's screens (visitAll), Hugo a member beside her; then the invite link
 * as Inès sees it, signed in but not a member: offering to join.
 */
async function* everyScreen(
  viewport: Viewport,
  { app, member, outsider }: Devices,
): AsyncGenerator<{ page: Page; path: string }> {
  await app.setViewportSize(viewport);
  await member("Hugo");
  for await (const path of visitAll(app)) {
    yield { page: app, path };
  }
  const ines = await outsider("Inès");
  await ines.setViewportSize(viewport);
  await ines.goto(await leasInvitation());
  await expect(ines.getByRole("button", { name: "REJOINDRE" })).toBeVisible();
  yield { page: ines, path: "/invitation (rejoindre)" };
}

test.describe("mise en page et accessibilité", () => {
  test.beforeEach(async ({ app }) => {
    // Viewports are set by hand: one project is enough.
    test.skip(test.info().project.name !== "desktop");
    await swipe(app, ["keep", "keep"]);
  });

  for (const viewport of VIEWPORTS) {
    test(`rien ne déborde en largeur : ${viewport.name}`, async ({
      app,
      member,
      outsider,
    }) => {
      const devices = { app, member, outsider };
      for await (const { page, path } of everyScreen(viewport, devices)) {
        await expectNoOverflow(page, path);
      }
    });

    test(`aucun défaut d'accessibilité grave (axe) : ${viewport.name}`, async ({
      app,
      member,
      outsider,
    }) => {
      const devices = { app, member, outsider };
      for await (const { page, path } of everyScreen(viewport, devices)) {
        expect(await seriousViolations(page, path)).toEqual([]);
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

  test("le premier groupe créé, la pastille a le focus", async ({
    newcomer,
  }) => {
    await newcomer.goto("/");
    await newcomer.getByLabel("NOM DU GROUPE").fill("Nous trois");
    await newcomer.getByRole("button", { name: "CRÉER LE GROUPE" }).click();

    await expect(
      newcomer.getByRole("button", { name: "Groupe affiché : Nous trois" }),
    ).toBeFocused();
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
