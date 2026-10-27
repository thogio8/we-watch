import { expect, swipe, test } from "./fixtures";

test.describe("tirer", () => {
  test("liste vide : rien à tirer", async ({ app }) => {
    await app.goto("/");
    await app.getByRole("button", { name: "TIRER UN FILM" }).click();

    await expect(
      app.getByRole("heading", { name: "RIEN À TIRER CE SOIR" }),
    ).toBeVisible();
  });

  test("tirer, retirer, puis « on le regarde » le passe en vu", async ({
    app,
  }) => {
    await swipe(app, ["keep", "keep"]);
    await app.goto("/");

    await app.getByRole("button", { name: "TIRER UN FILM" }).click();
    const first = await app.getByRole("heading", { level: 2 }).textContent();
    await app.getByRole("button", { name: "RETIRER" }).click();
    const second = app.getByRole("heading", { level: 2 });
    await expect(second).not.toHaveText(first ?? "");
    await expect(app.getByText(/PAS CE SOIR\s: 1/)).toBeVisible();

    await app.getByRole("button", { name: "ON LE REGARDE" }).click();
    await app.goto("/list");
    await expect(app.getByRole("tab", { name: /VUS · 1/ })).toBeVisible();
  });

  test("l'humeur filtre le tirage", async ({ app }) => {
    // Whiplash (drame) and Parasite (comédie, thriller).
    await swipe(app, ["keep", "reject", "keep"]);
    await app.goto("/");

    await app.getByRole("button", { name: /^LA SOIRÉE/ }).click();
    await app.getByRole("button", { name: "RIRE" }).click();

    await expect(
      app.getByRole("button", { name: "TIRER PARMI 1" }),
    ).toBeVisible();
    await app.getByRole("button", { name: "TIRER PARMI 1" }).click();
    await expect(app.getByRole("heading", { level: 2 })).toHaveText("Parasite");
  });

  test("← RETOUR et ↺ RESSORTIR : on peut revenir sur ses pas", async ({
    app,
  }) => {
    await swipe(app, ["keep", "keep"]);
    await app.goto("/");
    await app.getByRole("button", { name: "TIRER UN FILM" }).click();
    const first =
      (await app.getByRole("heading", { level: 2 }).textContent()) ?? "";

    await app.getByRole("button", { name: "RETIRER" }).click();
    await app.getByRole("button", { name: `↺ RESSORTIR ${first}` }).click();
    await expect(app.getByRole("heading", { level: 2 })).toHaveText(first);

    await app.getByRole("button", { name: "← RETOUR" }).click();
    await expect(
      app.getByRole("button", { name: "TIRER UN FILM" }),
    ).toBeVisible();
  });
});
