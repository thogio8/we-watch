import { expect, swipe, test } from "./fixtures";
import { expectNotHydrated, holdHydration } from "./hydration";

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

  test("une recherche tapée avant que la page soit prête est lancée", async ({
    app,
  }) => {
    const release = await holdHydration(app);
    await app.goto("/list", { waitUntil: "commit" });

    const field = app.getByLabel("Ajouter un film");
    await expectNotHydrated(field);
    await field.fill("amelie");
    await release();

    await expect(
      app.getByRole("button", {
        name: "Ajouter Le Fabuleux Destin d'Amélie Poulain",
      }),
    ).toBeVisible();
  });

  test("retirer un film le sort de la liste", async ({ app }) => {
    await swipe(app, ["keep"]);
    await app.goto("/list");

    await app.getByRole("button", { name: "Retirer Whiplash" }).click();

    await expect(app.getByRole("tab", { name: /À VOIR · 0/ })).toBeVisible();
  });

  test("la fiche d'un film : détail, générique, puis « vu » depuis la fiche", async ({
    app,
  }) => {
    await swipe(app, ["keep"]);
    await app.goto("/list");

    await app.getByRole("link", { name: /Whiplash/ }).click();

    await expect(app).toHaveURL(/\/list\/244786$/);
    await expect(app.getByRole("heading", { name: "Whiplash" })).toBeVisible();
    await expect(app.getByText("Damien Chazelle")).toBeVisible();
    await expect(app.getByText("Miles Teller, J.K. Simmons")).toBeVisible();

    await app.getByRole("button", { name: "ON L’A VU" }).click();

    await expect(app).toHaveURL(/\/list$/);
    await expect(app.getByRole("tab", { name: /VUS · 1/ })).toBeVisible();
  });

  test("une fiche hors de la liste : introuvable", async ({ app }) => {
    await app.goto("/list/129");

    await expect(
      app.getByRole("heading", { name: "FILM INTROUVABLE" }),
    ).toBeVisible();
  });
});
