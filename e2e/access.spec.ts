import { deleteSessions, expect, test } from "./fixtures";

const FORGED = [
  { name: "better-auth.session_token", value: "forge.abc" },
  { name: "better-auth.session_data", value: "bidon" },
].map((cookie) => ({ ...cookie, domain: "localhost", path: "/" }));

test.describe("connexion", () => {
  test("sans compte, toutes les pages renvoient vers la connexion", async ({
    page,
  }) => {
    for (const path of ["/", "/swipe", "/list"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/connexion/);
    }
  });

  test("un cookie de session forgé renvoie vers la connexion", async ({
    page,
  }) => {
    await page.context().addCookies(FORGED);

    await page.goto("/");

    await expect(page).toHaveURL(/\/connexion/);
  });

  test("une action serveur avec un cookie forgé reçoit une 401", async ({
    page,
  }) => {
    await page.context().addCookies(FORGED);

    const response = await page.request.post("/", {
      headers: { "next-action": "0".repeat(42) },
      data: "[]",
    });

    expect(response.status()).toBe(401);
  });

  // Before any page sets the session cache cookie (session_data): with it,
  // a deleted session is still accepted for up to 5 minutes (cookieCache in
  // src/auth/create-auth.ts), a known lag left for piece 5.
  test("une session supprimée, sans cache de session, renvoie vers la connexion", async ({
    app,
  }) => {
    await deleteSessions();

    await app.goto("/");

    await expect(app).toHaveURL(/\/connexion/);
  });

  test("connecté, le cache de session est posé dans le navigateur", async ({
    app,
  }) => {
    await app.goto("/");

    await expect(app).not.toHaveURL(/\/connexion/);
    const names = (await app.context().cookies()).map(({ name }) => name);
    expect(names).toContain("better-auth.session_data");
  });
});
