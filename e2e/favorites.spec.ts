import {
  expect,
  heart,
  listTitles,
  markFromList,
  settled,
  swipe,
  test,
} from "./fixtures";

const FAVORITES_HEADING = /^♥ COUPS DE CŒUR · /;

test.describe("coups de cœur", () => {
  test("marquer depuis la liste : le film passe en tête, sous son intertitre ; démarquer le remet dans la liste", async ({
    app,
  }) => {
    await swipe(app, ["keep", "keep", "keep"]);
    await app.goto("/list");
    // Newest first: Whiplash, swiped first, is last.
    await expect(listTitles(app).first()).toHaveText("Parasite");
    await expect(heart(app, "Whiplash")).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await heart(app, "Whiplash").click();

    await expect(app.getByText("♥ COUPS DE CŒUR · 1")).toBeVisible();
    await expect(app.getByText("LE RESTE · 2")).toBeVisible();
    await expect(heart(app, "Whiplash")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(listTitles(app).first()).toHaveText("Whiplash");

    await heart(app, "Whiplash").click();

    await expect(heart(app, "Whiplash")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(app.getByText(FAVORITES_HEADING)).toHaveCount(0);
    await expect(app.getByText(/^LE RESTE · /)).toHaveCount(0);
    await expect(listTitles(app)).toHaveCount(3);
    await expect(listTitles(app).first()).toHaveText("Parasite");
  });

  test("marquer depuis la fiche : le fantôme devient le tampon, et CHEZ NOUS dit coup de cœur de Léa", async ({
    app,
  }) => {
    await swipe(app, ["keep"]);
    await app.goto("/list/244786");
    await expect(app.getByText("♡ COUP DE CŒUR\u00A0?")).toBeVisible();
    await expect(app.getByText(/coup de cœur de Léa le/i)).toHaveCount(0);

    await heart(app, "Whiplash").click();

    await expect(heart(app, "Whiplash")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(
      app.getByText("♥ COUP DE CŒUR", { exact: true }),
    ).toBeVisible();
    await expect(app.getByText("♡ COUP DE CŒUR\u00A0?")).toHaveCount(0);
    await expect(app.getByText(/coup de cœur de Léa le/i)).toBeVisible();
    await expect(app).toHaveURL(/\/list\/244786$/);
  });

  test("Hugo, sur un second appareil, voit le coup de cœur de Léa", async ({
    app,
    member,
  }) => {
    await swipe(app, ["keep", "keep"]);
    await markFromList(app, "Le Voyage de Chihiro");

    const hugo = await member("Hugo");
    await hugo.goto("/list");

    await expect(hugo.getByText("♥ COUPS DE CŒUR · 1")).toBeVisible();
    await expect(heart(hugo, "Le Voyage de Chihiro")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(listTitles(hugo).first()).toHaveText("Le Voyage de Chihiro");
    await hugo.getByRole("link", { name: /Le Voyage de Chihiro/ }).click();
    await expect(hugo.getByText(/coup de cœur de Léa le/i)).toBeVisible();
  });

  test("TIRER avec le filtre : bouton rose, seul un coup de cœur peut sortir", async ({
    app,
  }) => {
    await swipe(app, ["keep", "keep", "keep"]);
    await markFromList(app, "Whiplash");
    await app.goto("/");
    await expect(app.getByText(/dont 1 ♥/)).toBeVisible();

    await app.getByRole("button", { name: /^LA SOIRÉE/ }).click();
    await expect(
      app.getByRole("button", { name: "TOUTE LA LISTE" }),
    ).toHaveAttribute("aria-pressed", "true");
    await app.getByRole("button", { name: "♥ NOS COUPS DE CŒUR · 1" }).click();

    const draw = app.getByRole("button", { name: "TIRER UN COUP DE CŒUR" });
    await expect(draw).toBeVisible();
    await draw.click();

    await expect(app.getByRole("heading", { level: 2 })).toHaveText("Whiplash");
    await expect(
      app.getByText("♥ COUP DE CŒUR", { exact: true }),
    ).toBeVisible();

    // Set aside, the only favourite leaves nothing else to draw.
    await app.getByRole("button", { name: "RETIRER" }).click();
    await expect(
      app.getByText("Le seul film qui collait est passé à la trappe"),
    ).toBeVisible();
  });

  test("sans le filtre, le film tiré porte le tampon ; ON LE REGARDE efface le coup de cœur", async ({
    app,
  }) => {
    await swipe(app, ["keep"]);
    await markFromList(app, "Whiplash");
    await app.goto("/");

    await app.getByRole("button", { name: "TIRER UN FILM" }).click();
    await expect(app.getByRole("heading", { level: 2 })).toHaveText("Whiplash");
    await expect(
      app.getByText("♥ COUP DE CŒUR", { exact: true }),
    ).toBeVisible();

    await app.getByRole("button", { name: "ON LE REGARDE" }).click();
    // Leaving at once would abort the save (WebKit cancels it).
    await settled(app);
    await app.goto("/list");
    await expect(app.getByRole("tab", { name: /VUS · 1/ })).toBeVisible();
    await expect(app.getByText(FAVORITES_HEADING)).toHaveCount(0);

    await app.getByRole("tab", { name: /VUS · 1/ }).click();
    await app.getByRole("button", { name: "Remettre Whiplash à voir" }).click();
    await expect(app.getByRole("tab", { name: /VUS · 0/ })).toBeVisible();
    await app.getByRole("tab", { name: /À VOIR · 1/ }).click();

    await expect(heart(app, "Whiplash")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(app.getByText(FAVORITES_HEADING)).toHaveCount(0);
  });
});
