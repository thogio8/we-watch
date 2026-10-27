import { expect, swipe, test } from "./fixtures";

test.describe("liste", () => {
  test("liste vide : invitation à swiper", async ({ app }) => {
    await app.goto("/list");

    await expect(app.getByText("RIEN À VOIR POUR L’INSTANT")).toBeVisible();
  });

  test("on ajoute un film depuis la recherche", async ({ app }) => {
    await app.goto("/list");

    await app.getByLabel("Ajouter un film").fill("amelie");
    await app
      .getByRole("button", {
        name: "Ajouter Le Fabuleux Destin d'Amélie Poulain",
      })
      .click();
    await app.getByRole("button", { name: "Effacer la recherche" }).click();

    await expect(app.getByRole("tab", { name: /À VOIR · 1/ })).toBeVisible();
    await expect(
      app.getByText("Le Fabuleux Destin d'Amélie Poulain"),
    ).toBeVisible();
  });

  test("retirer un film le sort de la liste", async ({ app }) => {
    await swipe(app, ["keep"]);
    await app.goto("/list");

    await app.getByRole("button", { name: "Retirer Whiplash" }).click();

    await expect(app.getByRole("tab", { name: /À VOIR · 0/ })).toBeVisible();
  });
});
