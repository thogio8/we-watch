import AxeBuilder from "@axe-core/playwright";
import { type Locator, type Page } from "@playwright/test";
import {
  box,
  emptyNameRefused,
  expect,
  leasInvitation,
  swipe,
  test,
  topCard,
} from "./fixtures";
import { COPY_LINK, pill } from "./groups";

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

/** « MON COMPTE », then its deletion ticket (the name not typed yet). */
async function* account(page: Page) {
  await page.goto("/compte");
  await expect(page.getByRole("heading", { name: "MON COMPTE" })).toBeVisible();
  yield "/compte";
  await page.getByRole("button", { name: "SUPPRIMER MON COMPTE" }).click();
  await expect(page.getByRole("group")).toBeVisible();
  yield "/compte (supprimer)";
}

/**
 * Every page, the group panel, the members screen, my account, an unknown
 * address, then signed out (cookies
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
  yield* account(page);
  await page.goto("/nulle-part");
  await expect(
    page.getByRole("heading", { name: /RIEN À L’AFFICHE/ }),
  ).toBeVisible();
  yield "/nulle-part (404)";
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

/** Spec §6: up to 30 characters, the widest glyph or long French words. */
const LONG_NAMES = ["W".repeat(30), "SOIRÉES CINÉ DE LA COLOCATION"];

/**
 * Léa's group renamed `name`: its members screen and leaving question, its
 * invite link as she sees it, as Inès sees it, then signed out.
 */
async function* longName(
  name: string,
  viewport: Viewport,
  { app, outsider }: Omit<Devices, "member">,
): AsyncGenerator<{ page: Page; path: string }> {
  await app.setViewportSize(viewport);
  await app.goto("/groupe");
  await app.getByLabel("NOM DU GROUPE").fill(name);
  await app.getByRole("button", { name: "RENOMMER" }).click();
  await expect(pill(app, name)).toBeVisible();
  yield { page: app, path: "/groupe" };
  await app.getByRole("button", { name: "QUITTER LE GROUPE" }).click();
  await expect(app.getByRole("group")).toBeVisible();
  yield { page: app, path: "/groupe (quitter)" };
  const link = await leasInvitation();
  await app.goto(link);
  await expect(app.getByRole("button", { name: "Y ALLER" })).toBeVisible();
  yield { page: app, path: "/invitation (déjà membre)" };
  const ines = await outsider("Inès");
  await ines.setViewportSize(viewport);
  await ines.goto(link);
  await expect(ines.getByRole("button", { name: "REJOINDRE" })).toBeVisible();
  yield { page: ines, path: "/invitation (rejoindre)" };
  await ines.context().clearCookies();
  await ines.reload();
  await expect(
    ines.getByRole("button", { name: "CRÉER UN COMPTE" }),
  ).toBeVisible();
  yield { page: ines, path: "/invitation (déconnecté)" };
}

test.describe("mise en page et accessibilité, nom de groupe long", () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== "desktop");
  });

  for (const viewport of VIEWPORTS) {
    for (const name of LONG_NAMES) {
      test(`${name} : ${viewport.name}`, async ({ app, outsider }) => {
        for await (const { page, path } of longName(name, viewport, {
          app,
          outsider,
        })) {
          await expectNoOverflow(page, path);
          expect(await seriousViolations(page, path)).toEqual([]);
        }
      });
    }
  }
});

test.describe("mise en page et accessibilité, prénom long", () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== "desktop");
  });

  for (const viewport of VIEWPORTS) {
    test(`« MON COMPTE » : ${viewport.name}`, async ({ app }) => {
      await app.setViewportSize(viewport);
      for await (const path of longAccountName(app)) {
        await expectNoOverflow(app, path);
        expect(await seriousViolations(app, path)).toEqual([]);
      }
    });
  }
});

/** Léa renamed with 30 of the widest glyph, then her deletion ticket. */
async function* longAccountName(page: Page) {
  const name = "W".repeat(30);
  await page.goto("/compte");
  await page.getByLabel("TON PRÉNOM").fill(name);
  await page.getByRole("button", { name: "CHANGER" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: name }),
  ).toBeVisible();
  yield "/compte (prénom long)";
  await page.getByRole("button", { name: "SUPPRIMER MON COMPTE" }).click();
  await page.getByLabel(`TAPE « ${name} » POUR CONFIRMER`).fill(name);
  await expect(
    page.getByRole("button", { name: "SUPPRIMER DÉFINITIVEMENT" }),
  ).toBeEnabled();
  yield "/compte (supprimer, prénom long)";
}

/** Each element whole between the nav and the screen's other edge, unscrolled. */
async function expectOnScreen(
  page: Page,
  viewport: Viewport,
  elements: readonly (readonly [string, Locator])[],
) {
  const nav = await box(
    page.getByRole("navigation", { name: "Navigation principale" }),
  );
  // The nav sits at the bottom on phones, at the top on wide screens.
  const navAtBottom = nav.y > viewport.height / 2;
  const top = navAtBottom ? 0 : nav.y + nav.height;
  const bottom = navAtBottom ? nav.y : viewport.height;
  for (const [name, element] of elements) {
    const { y, height } = await box(element);
    expect(y, `${name} commence sous la nav`).toBeGreaterThanOrEqual(top);
    expect(
      y + height,
      `${name} finit avant la nav ou le bas de l’écran`,
    ).toBeLessThanOrEqual(bottom);
  }
}

test.describe("un écran sans défiler", () => {
  test.beforeEach(async ({ app }) => {
    test.skip(test.info().project.name !== "desktop");
    await swipe(app, ["keep", "keep"]);
  });

  for (const viewport of VIEWPORTS.filter(({ name }) => name !== "iPad")) {
    test(`TIRER : le bouton et l’heure, ni sous la nav ni à défiler : ${viewport.name}`, async ({
      app,
    }) => {
      await app.setViewportSize(viewport);
      await app.goto("/");
      const clock = app.getByText(/^Il est \d/);
      await expect(clock).toBeVisible();
      await expectOnScreen(app, viewport, [
        ["TIRER", app.getByRole("button", { name: "TIRER UN FILM" })],
        ["l’heure", clock],
      ]);
    });

    test(`SWIPER : la carte et ses deux boutons, ni sous la nav ni à défiler : ${viewport.name}`, async ({
      app,
    }) => {
      await app.setViewportSize(viewport);
      await app.goto("/swipe");
      await expect(topCard(app)).toBeVisible();
      await expectOnScreen(app, viewport, [
        ["la pastille", pill(app, "NOUS DEUX")],
        ["✕ BOF", app.getByRole("button", { name: "✕ BOF" })],
        ["ON LE VEUT ♥", app.getByRole("button", { name: "ON LE VEUT ♥" })],
      ]);
    });
  }
});

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
