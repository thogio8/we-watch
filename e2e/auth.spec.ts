import AxeBuilder from "@axe-core/playwright";
import { type Page } from "@playwright/test";
import { accountNames, expect, signUpAs, test } from "./fixtures";

/** The app is open: on TIRER, with its navigation (absent from /connexion). */
async function expectInApp(page: Page) {
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("navigation", { name: "Navigation principale" }),
  ).toBeVisible();
}

test.describe("comptes et passkeys", () => {
  test("créer un compte avec une passkey ouvre l'appli", async ({
    visitor,
  }) => {
    await signUpAs(visitor, "  Léa  ");

    await expectInApp(visitor);
    expect(await accountNames()).toEqual(["Léa"]);
  });

  test("se déconnecter puis revenir avec sa passkey", async ({ visitor }) => {
    await signUpAs(visitor, "Léa");
    await expectInApp(visitor);

    await visitor.goto("/list");
    await visitor.getByRole("button", { name: "SE DÉCONNECTER" }).click();
    await expect(visitor).toHaveURL("/connexion");
    await visitor.goto("/");
    await expect(visitor).toHaveURL("/connexion");

    await visitor.getByRole("button", { name: "SE CONNECTER" }).click();

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

  test("un navigateur sans clés d’accès l’explique, sans bouton", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      delete (window as { PublicKeyCredential?: unknown }).PublicKeyCredential;
    });

    await page.goto("/connexion");

    await expect(
      page.getByText(
        "CE NAVIGATEUR NE GÈRE PAS LES CLÉS D’ACCÈS. METS-LE À JOUR OU ESSAIE UN AUTRE APPAREIL.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("button")).toHaveCount(0);
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(
      violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      ),
    ).toEqual([]);
  });
});
