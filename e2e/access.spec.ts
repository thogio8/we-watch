import { expect, test } from "@playwright/test";
import { enterCode, unlock } from "./fixtures";

test.describe("code d'accès", () => {
  test("sans code, toutes les pages renvoient vers l'écran du code", async ({
    page,
  }) => {
    for (const path of ["/", "/swipe", "/list"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/unlock/);
    }
  });

  test("un mauvais code est refusé", async ({ page }) => {
    await enterCode(page, "pas le bon code");

    await expect(page.getByText("MAUVAIS CODE")).toBeVisible();
    await expect(page).toHaveURL(/\/unlock/);
  });

  test("le bon code ouvre l'appli, et le téléphone s'en souvient", async ({
    page,
  }) => {
    await unlock(page);

    await expect(
      page.getByRole("heading", { level: 1, name: "CE SOIR ON REGARDE" }),
    ).toBeVisible();
    await page.goto("/list");
    await expect(
      page.getByRole("heading", { name: "NOTRE LISTE" }),
    ).toBeVisible();
  });
});
