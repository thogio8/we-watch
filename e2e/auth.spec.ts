import { type Page } from "@playwright/test";
import { accountNames, expect, signUpAs, test } from "./fixtures";

/** The app is open: on TIRER, with its navigation (absent from /connexion). */
async function expectInApp(page: Page) {
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("navigation", { name: "Navigation principale" }),
  ).toBeVisible();
}

test.describe("comptes et Face ID", () => {
  test("créer un compte avec Face ID ouvre l'appli", async ({ visitor }) => {
    await signUpAs(visitor, "  Léa  ");

    await expectInApp(visitor);
    expect(await accountNames()).toEqual(["Léa"]);
  });

  test("se déconnecter puis revenir avec Face ID", async ({ visitor }) => {
    await signUpAs(visitor, "Léa");
    await expectInApp(visitor);

    await visitor.goto("/list");
    await visitor.getByRole("button", { name: "SE DÉCONNECTER" }).click();
    await expect(visitor).toHaveURL("/connexion");
    await visitor.goto("/");
    await expect(visitor).toHaveURL("/connexion");

    await visitor
      .getByRole("button", { name: "SE CONNECTER AVEC FACE ID" })
      .click();

    await expectInApp(visitor);
    expect(await accountNames()).toEqual(["Léa"]);
  });

  test("un prénom vide est refusé", async ({ visitor }) => {
    await signUpAs(visitor, "   ");

    await expect(
      visitor.getByText("UN PRÉNOM DE 1 À 30 CARACTÈRES"),
    ).toBeVisible();
    await expect(visitor.getByLabel("TON PRÉNOM OU SURNOM")).toBeFocused();
    await expect(visitor).toHaveURL("/connexion");
    expect(await accountNames()).toEqual([]);
  });
});
