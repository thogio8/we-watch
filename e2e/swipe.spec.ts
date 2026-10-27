import { expect, listTitles, settled, swipe, test, topCard } from "./fixtures";

test.describe("swiper", () => {
  test("♥ ajoute à la liste, ✕ écarte pour de bon", async ({ app }) => {
    await swipe(app, ["keep", "reject"]);

    await expect(topCard(app)).toHaveText("Parasite");
    await app.getByRole("link", { name: "LISTE" }).click();
    await expect(listTitles(app)).toHaveText(["Whiplash"]);
  });

  test("↺ ANNULER fait revenir la carte", async ({ app }) => {
    await swipe(app, ["keep"]);

    await app.getByRole("button", { name: "↺ ANNULER" }).click();

    await expect(topCard(app)).toHaveText("Whiplash");
    await settled(app);
    await app.goto("/list");
    await expect(app.getByRole("tab", { name: /À VOIR · 0/ })).toBeVisible();
  });

  test("la fiche montre plateformes et bande-annonce", async ({ app }) => {
    await app.goto("/swipe");

    const deck = app.getByRole("region", { name: "Film à trier" });
    await expect(deck.getByText("2014 · 1H47")).toBeVisible();
    await expect(
      deck.getByRole("link", { name: /Bande-annonce/ }),
    ).toHaveAttribute("href", /7d_jQycdQGo/);
  });

  test("un thème se choisit dans la rangée de puces", async ({ app }) => {
    await app.goto("/swipe");

    await app
      .getByRole("navigation", { name: "Thèmes" })
      .getByRole("link", { name: "ANIMATION" })
      .click();

    await expect(app).toHaveURL(/deck=animation/);
    await expect(topCard(app)).toBeVisible();
  });

  test("tout trié : écran de fin du thème", async ({ app }) => {
    await swipe(app, ["reject", "reject", "reject", "reject", "reject"]);

    await expect(
      app.getByRole("heading", { name: "VOUS AVEZ TOUT VU (OU PRESQUE)" }),
    ).toBeVisible();
  });
});
