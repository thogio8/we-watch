import { type Page } from "@playwright/test";
import {
  CONTINUE,
  MATCH_HINT,
  MATCH_KEPT,
  MATCH_TEXT,
  MATCH_TITLE,
  SEE_LIST,
} from "../src/features/swipe/messages";
import {
  decide,
  expect,
  leasInvitation,
  settled,
  swipe,
  test,
  topCard,
} from "./fixtures";
import {
  closeMatch,
  deck,
  keepToMatch,
  listRow,
  matchMoment,
  smallMatchStamp,
} from "./match";

/**
 * Léa keeps Whiplash; Hugo, on a second device, finds it on top of his deck
 * and keeps it too: the match, its moment open on his screen.
 */
async function hugoMatches(app: Page, member: (name: string) => Promise<Page>) {
  await swipe(app, ["keep"]);
  const hugo = await member("Hugo");
  await hugo.goto("/swipe");
  await expect(topCard(hugo)).toHaveText("Whiplash");
  await keepToMatch(hugo);
  return hugo;
}

/** What has the focus: its role and text, `BODY` when nothing does. */
const focused = (page: Page) =>
  page.evaluate(() => {
    const element = document.activeElement;
    if (element === null || element === document.body) return "BODY";
    return `${element.tagName} ${element.textContent?.trim() ?? ""}`;
  });

/**
 * Presses Tab from the focused element until the focus comes back to it,
 * once around the page: everything Tab reaches on the way.
 */
async function tabAround(page: Page) {
  const start = await focused(page);
  const reached: string[] = [];
  for (let press = 0; press < 60; press++) {
    await page.keyboard.press("Tab");
    const now = await focused(page);
    if (now === start) return reached;
    reached.push(now);
  }
  throw new Error(`la tabulation ne revient jamais sur ${start}`);
}

/** Animations running on the moment's big stamp (the one naming the dialog). */
const stampAnimations = (page: Page) =>
  matchMoment(page).evaluate(
    (dialog) =>
      document
        .getElementById(dialog.getAttribute("aria-labelledby") ?? "")
        ?.getAnimations().length ?? -1,
  );

test.describe("c’est un match", () => {
  test("Léa garde un film ; Hugo le trouve en tête de sa pile avec « LÉA LE VEUT », le garde et voit le moment du match ; CONTINUER le ferme", async ({
    app,
    member,
  }) => {
    await swipe(app, ["keep"]);
    const hugo = await member("Hugo");
    await hugo.goto("/swipe");

    await expect(topCard(hugo)).toHaveText("Whiplash");
    await expect(deck(hugo).getByText("LÉA LE VEUT")).toBeVisible();
    await expect(hugo.getByText(MATCH_HINT)).toBeVisible();

    await keepToMatch(hugo);
    await expect(matchMoment(hugo).getByText(MATCH_TITLE)).toBeVisible();
    await expect(matchMoment(hugo).getByText(MATCH_TEXT)).toBeVisible();
    const proceed = matchMoment(hugo).getByRole("button", { name: CONTINUE });
    await expect(proceed).toBeFocused();

    // Escape closes it too; here, the button.
    await closeMatch(hugo);
    // The focus goes back to the deck, which works again.
    await expect(deck(hugo)).toBeFocused();
    await expect(topCard(hugo)).toHaveText("Le Voyage de Chihiro");
    await decide(hugo, "keep");
    await expect(topCard(hugo)).toHaveText("Parasite");
    await expect(matchMoment(hugo)).toHaveCount(0);
  });

  test("pendant le moment du match, la tabulation n’atteint jamais les boutons de la pile ; Échap le ferme et la pile répond", async ({
    app,
    member,
  }) => {
    const hugo = await hugoMatches(app, member);

    const reached = await tabAround(hugo);
    // Once around: past « ↺ ANNULER », the nav, the pill and the themes, to
    // « VOIR LA LISTE », the deck's place in between, never to its buttons.
    expect(reached).toContain("BUTTON ↺ ANNULER");
    expect(reached).toContain(`A ${SEE_LIST}`);
    expect(reached).not.toContainEqual(expect.stringContaining("ON LE VEUT"));
    expect(reached).not.toContainEqual(expect.stringContaining("BOF"));

    await matchMoment(hugo)
      .getByRole("button", { name: CONTINUE })
      .press("Escape");
    await expect(matchMoment(hugo)).toHaveCount(0);
    await decide(hugo, "reject");
    await expect(topCard(hugo)).toHaveText("Parasite");
  });

  test("mouvement réduit : le gros tampon s’imprime sans animation", async ({
    app,
    member,
  }) => {
    // Every project emulates `prefers-reduced-motion: reduce`.
    const hugo = await hugoMatches(app, member);
    expect(await stampAnimations(hugo)).toBe(0);

    // The check can fail: without the preference, the stamp thumps.
    await hugo.emulateMedia({ reducedMotion: "no-preference" });
    expect(await stampAnimations(hugo)).toBeGreaterThan(0);
  });

  test("les deux voient le tampon MATCH dans la LISTE, et la fiche dit « match du groupe »", async ({
    app,
    member,
  }) => {
    const hugo = await hugoMatches(app, member);
    await closeMatch(hugo);
    await settled(hugo);

    for (const page of [app, hugo]) {
      await page.goto("/list");
      const row = listRow(page, "Whiplash");
      await expect(smallMatchStamp(row)).toBeVisible();
      await expect(row.getByText("voulu par vous deux")).toBeVisible();
    }
    await app.goto("/list/244786");
    await expect(app.getByText(/^match du groupe le /)).toBeVisible();
  });

  test("TIRER avec « NOS MATCHS » ne sort que le match", async ({
    app,
    member,
  }) => {
    const hugo = await hugoMatches(app, member);
    await closeMatch(hugo);
    await settled(hugo);
    // Two more films in the list, wanted by Léa alone.
    await swipe(app, ["keep", "keep"]);

    await app.goto("/");
    await expect(app.getByText(/dont 1 match\b/)).toBeVisible();
    await app.getByRole("button", { name: /^LA SOIRÉE/ }).click();
    const matches = app.getByRole("button", { name: "♥♥ NOS MATCHS · 1" });
    await matches.click();
    await expect(matches).toHaveAttribute("aria-pressed", "true");
    await app.getByRole("button", { name: "TIRER UN MATCH" }).click();

    await expect(app.getByRole("heading", { level: 2 })).toHaveText("Whiplash");
    await expect(smallMatchStamp(app)).toBeVisible();
    // Set aside, the only match leaves nothing else to draw.
    await app.getByRole("button", { name: "RETIRER" }).click();
    await expect(
      app.getByText("Le seul film qui collait est passé à la trappe"),
    ).toBeVisible();
  });

  test("« ↺ ANNULER » juste après le match défait le match", async ({
    app,
    member,
  }) => {
    const hugo = await hugoMatches(app, member);

    await hugo.getByRole("button", { name: "↺ ANNULER" }).click();

    await expect(matchMoment(hugo)).toHaveCount(0);
    await expect(topCard(hugo)).toHaveText("Whiplash");
    await expect(hugo.getByText(MATCH_HINT)).toBeVisible();
    await settled(hugo);
    for (const page of [app, hugo]) {
      await page.goto("/list");
      const row = listRow(page, "Whiplash");
      // Still Léa's wish, no longer a match.
      await expect(row.getByText("voulu par Léa")).toBeVisible();
      await expect(smallMatchStamp(row)).toHaveCount(0);
    }
    await app.goto("/");
    await expect(app.getByText(/1 film à regarder/)).toBeVisible();
    await expect(app.getByText(/dont \d+ match/)).toHaveCount(0);
  });

  test("Sam rejoint par le lien : le match reste, et Sam trouve le film dans sa pile avec le petit tampon", async ({
    app,
    member,
    outsider,
  }) => {
    const hugo = await hugoMatches(app, member);
    await closeMatch(hugo);
    await settled(hugo);

    const sam = await outsider("Sam");
    await sam.goto(await leasInvitation());
    await sam.getByRole("button", { name: "REJOINDRE" }).click();
    await expect(sam).toHaveURL("/");

    await sam.goto("/list");
    const row = listRow(sam, "Whiplash");
    await expect(smallMatchStamp(row)).toBeVisible();
    // Not every member wants it now, and the line says so.
    await expect(row.getByText("voulu par Léa et Hugo")).toBeVisible();

    await sam.goto("/swipe");
    await expect(topCard(sam)).toHaveText("Whiplash");
    await expect(smallMatchStamp(deck(sam))).toBeVisible();
    await expect(deck(sam).getByText("LÉA ET HUGO LE VEULENT")).toBeVisible();
    await expect(sam.getByText(MATCH_KEPT)).toBeVisible();
    await expect(sam.getByText(MATCH_HINT)).toHaveCount(0);

    // Already a match: Sam's keep opens no moment.
    await decide(sam, "keep");
    await settled(sam);
    await expect(matchMoment(sam)).toHaveCount(0);
    await app.goto("/list");
    await expect(smallMatchStamp(listRow(app, "Whiplash"))).toBeVisible();
  });
});
