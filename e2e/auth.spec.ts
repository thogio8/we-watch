import AxeBuilder from "@axe-core/playwright";
import { type Page } from "@playwright/test";
import {
  accountNames,
  expect,
  signUpAs,
  test,
  UNSUPPORTED_MESSAGE,
  withoutPasskeys,
} from "./fixtures";

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

  test("un navigateur sans clés d’accès l’explique, sans bouton ni erreur d’hydratation", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await withoutPasskeys(page);

    await page.goto("/connexion");

    await expect(page.getByText(UNSUPPORTED_MESSAGE)).toBeVisible();
    await expect(page.getByRole("button")).toHaveCount(0);
    // A hydration mismatch is logged as an error (React #418 in production).
    expect(errors).toEqual([]);
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(
      violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      ),
    ).toEqual([]);
  });
});
