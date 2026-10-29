import { type Page } from "@playwright/test";
import { accountNames, expect, test } from "./fixtures";

/** Spec §9: the account is created by the Face ID that will open it. */
async function createAccount(page: Page, name: string) {
  await page.goto("/connexion");
  await page.getByRole("button", { name: "CRÉER UN COMPTE" }).click();
  await page.getByLabel("TON PRÉNOM OU SURNOM").fill(name);
  await page.getByRole("button", { name: "CRÉER AVEC FACE ID" }).click();
}

/** The app is open: on TIRER, with its navigation (absent from /connexion). */
async function expectInApp(page: Page) {
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("navigation", { name: "Navigation principale" }),
  ).toBeVisible();
}

test.describe("comptes et Face ID", () => {
  test("créer un compte avec Face ID ouvre l'appli", async ({ visitor }) => {
    await createAccount(visitor, "  Léa  ");

    await expectInApp(visitor);
    expect(await accountNames()).toEqual(["Léa"]);
  });

  test("se déconnecter puis revenir avec Face ID", async ({ visitor }) => {
    await createAccount(visitor, "Léa");
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
    await createAccount(visitor, "   ");

    await expect(
      visitor.getByText("UN PRÉNOM DE 1 À 30 CARACTÈRES"),
    ).toBeVisible();
    await expect(visitor.getByLabel("TON PRÉNOM OU SURNOM")).toBeFocused();
    await expect(visitor).toHaveURL("/connexion");
    expect(await accountNames()).toEqual([]);
  });
});
