import AxeBuilder from "@axe-core/playwright";
import { type Locator, type Page } from "@playwright/test";
import {
  box,
  emptyNameRefused,
  expect,
  leasInvitation,
  markFromList,
  settled,
  swipe,
  test,
  topCard,
} from "./fixtures";
import { COPY_LINK, pill } from "./groups";
import { CONTINUE, MATCH_HINT, SEE_LIST } from "../src/features/swipe/messages";
import { closeMatch, keepToMatch, matchMoment } from "./match";

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

const AMELIE = "Le Fabuleux Destin d'Amélie Poulain";

/** On the draw's home, the favourites filter chosen in its panel. */
async function favoritesPool(page: Page) {
  await page.getByRole("button", { name: /^LA SOIRÉE/ }).click();
  await page.getByRole("button", { name: /^♥ NOS COUPS DE CŒUR · / }).click();
  await expect(
    page.getByRole("button", { name: "TIRER UN COUP DE CŒUR" }),
  ).toBeVisible();
}

/**
 * Whiplash and Amélie (the longest title) favourites among four: the list,
 * a favourite's page, a ghost's page, the draw with its filter on, the
 * favourite drawn.
 */
async function* favoriteScreens(page: Page) {
  await page.goto("/list");
  await expect(page.getByText("♥ COUPS DE CŒUR · 2")).toBeVisible();
  yield "/list (coups de cœur)";
  await page.goto("/list/194");
  await expect(page.getByText(/coup de cœur de Léa le/)).toBeVisible();
  yield "/list/194 (coup de cœur)";
  await page.goto("/list/129");
  await expect(page.getByText("♡ COUP DE CŒUR\u00A0?")).toBeVisible();
  yield "/list/129 (fantôme)";
  await page.goto("/");
  await favoritesPool(page);
  yield "/ (filtre coups de cœur)";
  await page.getByRole("button", { name: "TIRER UN COUP DE CŒUR" }).click();
  await expect(page.getByText("♥ COUP DE CŒUR", { exact: true })).toBeVisible();
  yield "/ (coup de cœur tiré)";
}

test.describe("mise en page et accessibilité, coups de cœur", () => {
  test.beforeEach(async ({ app }) => {
    test.skip(test.info().project.name !== "desktop");
    await swipe(app, ["keep", "keep", "keep", "keep"]);
    await markFromList(app, AMELIE);
    await markFromList(app, "Whiplash");
  });

  for (const viewport of VIEWPORTS) {
    test(`coups de cœur : ${viewport.name}`, async ({ app }) => {
      await app.setViewportSize(viewport);
      for await (const path of favoriteScreens(app)) {
        await expectNoOverflow(app, path);
        expect(await seriousViolations(app, path)).toEqual([]);
      }
    });
  }
});

/** A member of Léa's group on a second device, in `viewport`. */
async function memberIn(
  viewport: Viewport,
  member: Devices["member"],
  name: string,
) {
  const page = await member(name);
  await page.setViewportSize(viewport);
  return page;
}

/**
 * Hugo's deck topped by Léa's latest film and its banner, the match moment
 * once he keeps it; Léa's list, the draw among three pools with the matches
 * chosen, the match drawn; Sam's deck, the match made before he came.
 */
async function* matchScreens(
  viewport: Viewport,
  { app, member }: Omit<Devices, "outsider">,
): AsyncGenerator<{ page: Page; path: string }> {
  const hugo = await memberIn(viewport, member, "Hugo");
  await hugo.goto("/swipe");
  await expect(topCard(hugo)).toHaveText("Le Voyage de Chihiro");
  yield { page: hugo, path: "/swipe (bandeau)" };
  await keepToMatch(hugo);
  yield { page: hugo, path: "/swipe (moment du match)" };
  await closeMatch(hugo);
  await settled(hugo);

  await app.setViewportSize(viewport);
  await markFromList(app, "Whiplash");
  yield { page: app, path: "/list (match et coup de cœur)" };
  await app.goto("/");
  await app.getByRole("button", { name: /^LA SOIRÉE/ }).click();
  await app.getByRole("button", { name: "♥♥ NOS MATCHS · 1" }).click();
  await expect(
    app.getByRole("button", { name: "♥ NOS COUPS DE CŒUR · 1" }),
  ).toBeVisible();
  yield { page: app, path: "/ (trois puces, les matchs choisis)" };
  await app.getByRole("button", { name: "TIRER UN MATCH" }).click();
  await expect(app.getByRole("heading", { level: 2 })).toHaveText(
    "Le Voyage de Chihiro",
  );
  yield { page: app, path: "/ (match tiré)" };

  const sam = await memberIn(viewport, member, "Sam");
  await sam.goto("/swipe");
  await expect(topCard(sam)).toHaveText("Le Voyage de Chihiro");
  yield { page: sam, path: "/swipe (match d’avant mon arrivée)" };
}

test.describe("mise en page et accessibilité, matchs", () => {
  test.beforeEach(async ({ app }) => {
    test.skip(test.info().project.name !== "desktop");
    await swipe(app, ["keep", "keep"]);
  });

  for (const viewport of VIEWPORTS) {
    test(`matchs : ${viewport.name}`, async ({ app, member }) => {
      for await (const { page, path } of matchScreens(viewport, {
        app,
        member,
      })) {
        await expectNoOverflow(page, path);
        expect(await seriousViolations(page, path)).toEqual([]);
      }
    });
  }
});

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

    test(`TIRER avec le filtre coups de cœur : le bouton rose et l’heure : ${viewport.name}`, async ({
      app,
    }) => {
      await markFromList(app, "Whiplash");
      await app.setViewportSize(viewport);
      await app.goto("/");
      await favoritesPool(app);
      // Folded again, as the evening goes: the filter stays on.
      await app.getByRole("button", { name: /^LA SOIRÉE/ }).click();
      const clock = app.getByText(/^Il est \d/);
      await expect(clock).toBeVisible();
      await expectOnScreen(app, viewport, [
        [
          "TIRER UN COUP DE CŒUR",
          app.getByRole("button", { name: "TIRER UN COUP DE CŒUR" }),
        ],
        ["l’heure", clock],
      ]);
    });

    test(`SWIPER, un film que le groupe veut : la phrase et les deux boutons, puis le moment du match : ${viewport.name}`, async ({
      member,
    }) => {
      const hugo = await memberIn(viewport, member, "Hugo");
      await hugo.goto("/swipe");
      await expect(topCard(hugo)).toHaveText("Le Voyage de Chihiro");
      await expectOnScreen(hugo, viewport, [
        ["la phrase", hugo.getByText(MATCH_HINT)],
        ["✕ BOF", hugo.getByRole("button", { name: "✕ BOF" })],
        ["ON LE VEUT ♥", hugo.getByRole("button", { name: "ON LE VEUT ♥" })],
      ]);
      await expectNoVerticalScroll(hugo, "/swipe (phrase)");
      await keepToMatch(hugo);
      // The moment's layer covers the nav: its buttons need only the screen.
      for (const button of [
        matchMoment(hugo).getByRole("link", { name: SEE_LIST }),
        matchMoment(hugo).getByRole("button", { name: CONTINUE }),
      ]) {
        const { y, height } = await box(button);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y + height).toBeLessThanOrEqual(viewport.height);
      }
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
      await expectNoVerticalScroll(app, "/swipe");
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

/** The deck fits the screen: nothing to scroll, not even the shell's room. */
async function expectNoVerticalScroll(page: Page, path: string) {
  const scroll = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  );
  expect(scroll, `${path} défile de ${scroll}px`).toBeLessThanOrEqual(0);
}

async function expectNoOverflow(page: Page, path: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, `${path} déborde de ${overflow}px`).toBeLessThanOrEqual(0);
}

/** axe's serious and critical findings, contrast included. */
async function seriousViolations(page: Page, path: string) {
  // Next streams the metadata apart: after a refresh, the <title> may come
  // a moment after the screen. A title that never comes still fails here.
  await expect(page, `${path} : titre`).toHaveTitle(/\S/);
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${path} ${v.id}: ${v.help}`);
}
