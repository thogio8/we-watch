import { type Page } from "@playwright/test";
import {
  decide,
  expect,
  listTitles,
  settled,
  swipe,
  test,
  topCard,
} from "./fixtures";
import { chooseGroup, createGroup, pill } from "./groups";

test.describe("groupes", () => {
  test("deux membres veulent le même film : il est voulu par Léa et Hugo", async ({
    app,
    member,
  }) => {
    const hugo = await member("Hugo");
    // Both decks are on screen before either decides.
    await hugo.goto("/swipe");
    await expect(topCard(hugo)).toHaveText("Whiplash");

    await swipe(app, ["keep"]);
    await decide(hugo, "keep");
    await settled(hugo);

    for (const page of [app, hugo]) {
      await page.goto("/list");
      await expect(listTitles(page)).toHaveText(["Whiplash"]);
      await expect(page.getByText("voulu par Léa et Hugo")).toBeVisible();
    }
  });

  test("un BOF ne cache le film qu’à celui qui l’a mis", async ({
    app,
    member,
  }) => {
    const hugo = await member("Hugo");
    await swipe(hugo, ["reject"]);

    await app.goto("/swipe");
    await expect(topCard(app)).toHaveText("Whiplash");
    await app.goto("/list");
    await expect(app.getByRole("tab", { name: /À VOIR · 0/ })).toBeVisible();

    await hugo.goto("/swipe");
    await expect(topCard(hugo)).toHaveText("Le Voyage de Chihiro");
    // His BOF follows him into his other groups.
    await createGroup(hugo, "Hugo seul");
    await hugo.goto("/swipe");
    await expect(topCard(hugo)).toHaveText("Le Voyage de Chihiro");
  });

  test("créer un groupe depuis la pastille, y basculer : sa liste est vide, celle de NOUS DEUX est intacte", async ({
    app,
  }) => {
    await swipe(app, ["keep"]);
    await app.goto("/list");

    await createGroup(app, "Ciné club");
    await expect(app.getByText("RIEN À VOIR POUR L’INSTANT")).toBeVisible();

    await chooseGroup(app, "NOUS DEUX");
    await expect(listTitles(app)).toHaveText(["Whiplash"]);
  });

  test("sans groupe, on arrive sur CRÉER TON PREMIER GROUPE", async ({
    newcomer,
  }) => {
    for (const path of ["/", "/swipe", "/list", "/list/244786"]) {
      await newcomer.goto(path);
      await expect(
        newcomer.getByRole("heading", { name: "CRÉER TON PREMIER GROUPE" }),
      ).toBeVisible();
    }
  });

  test("le second appareil a les réglages du projet, comme celui de Léa", async ({
    app,
    member,
  }) => {
    const hugo = await member("Hugo");
    const device = (page: Page) =>
      page.evaluate(() => ({
        language: navigator.language,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
        touch: navigator.maxTouchPoints > 0,
        pixelRatio: devicePixelRatio,
        userAgent: navigator.userAgent,
      }));

    expect(hugo.viewportSize()).toEqual(app.viewportSize());
    expect(await device(hugo)).toEqual(await device(app));
  });

  test("le premier groupe créé s’affiche aussitôt, pastille comprise", async ({
    newcomer,
  }) => {
    await newcomer.goto("/swipe");
    await newcomer.getByLabel("NOM DU GROUPE").fill("Ciné club");
    await newcomer.getByRole("button", { name: "CRÉER LE GROUPE" }).click();

    await expect(pill(newcomer, "Ciné club")).toBeVisible();
    await expect(topCard(newcomer)).toHaveText("Whiplash");
  });

  for (const path of ["/", "/swipe"]) {
    test(`sur ${path}, la pastille suit le groupe créé puis choisi`, async ({
      app,
    }) => {
      await app.goto(path);
      await createGroup(app, "Ciné club");
      await chooseGroup(app, "NOUS DEUX");
    });
  }

  test("le groupe affiché est retenu sur l’appareil", async ({ app }) => {
    await app.goto("/list");
    await createGroup(app, "Ciné club");
    await chooseGroup(app, "NOUS DEUX");

    await app.reload();
    await expect(pill(app, "NOUS DEUX")).toBeVisible();
    await app.goto("/swipe");
    await expect(pill(app, "NOUS DEUX")).toBeVisible();
    const cookies = await app.context().cookies();
    expect(cookies.find(({ name }) => name === "ww_group")?.value).toBe(
      "groupe-e2e",
    );
  });

  test("une fiche d’un autre groupe répond FILM INTROUVABLE", async ({
    app,
  }) => {
    await swipe(app, ["keep"]);
    await app.goto("/list/244786");
    await expect(app.getByRole("heading", { name: "Whiplash" })).toBeVisible();

    await app.goto("/list");
    await createGroup(app, "Ciné club");
    await app.goto("/list/244786");

    await expect(
      app.getByRole("heading", { name: "FILM INTROUVABLE" }),
    ).toBeVisible();
  });

  test("deux onglets : un groupe créé dans l’un, l’autre bascule sa pile avec sa pastille", async ({
    app,
  }) => {
    const other = await app.context().newPage();
    await other.goto("/swipe");
    await expect(pill(other, "NOUS DEUX")).toBeVisible();
    await expect(topCard(other)).toHaveText("Whiplash");

    await app.goto("/list");
    await createGroup(app, "LA COLOC");
    // Saved in « NOUS DEUX », the deck on screen; the save re-renders the
    // tab on the displayed group, « LA COLOC », cards included.
    await decide(other, "keep");
    await expect(pill(other, "LA COLOC")).toBeVisible();
    await expect(topCard(other)).toHaveText("Whiplash");
    await decide(other, "keep");
    await settled(other);

    await app.goto("/list");
    await expect(listTitles(app)).toHaveText(["Whiplash"]);
    await chooseGroup(app, "NOUS DEUX");
    await expect(listTitles(app)).toHaveText(["Whiplash"]);
    await other.close();
  });
});
