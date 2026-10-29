import { expect, test } from "./fixtures";

test.describe("connexion", () => {
  test("sans compte, toutes les pages renvoient vers la connexion", async ({
    page,
  }) => {
    for (const path of ["/", "/swipe", "/list"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/connexion/);
    }
  });
});
