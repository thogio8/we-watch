import { type Page } from "@playwright/test";
import {
  accountNames,
  expect,
  listTitles,
  signUpAs,
  swipe,
  test,
  virtualAuthenticator,
} from "./fixtures";

/** A titled list of « MON COMPTE »: « TES CLÉS D’ACCÈS », « TES APPAREILS ». */
const rows = (page: Page, title: string) =>
  page.getByRole("list", { name: title }).getByRole("listitem");

const passkeys = (page: Page) => rows(page, "TES CLÉS D’ACCÈS");
const devices = (page: Page) => rows(page, "TES APPAREILS");

/** « AJOUTER UNE CLÉ D’ACCÈS » on /compte; the list then has `count` keys. */
async function addPasskey(page: Page, count: number) {
  await page.goto("/compte");
  await page.getByRole("button", { name: "AJOUTER UNE CLÉ D’ACCÈS" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "CLÉ AJOUTÉE" }),
  ).toBeVisible();
  await expect(passkeys(page)).toHaveCount(count);
}

/** « SE DÉCONNECTER » on /compte: the device lands on the sign-in page. */
async function signOut(page: Page) {
  await page.goto("/compte");
  await page.getByRole("button", { name: "SE DÉCONNECTER" }).click();
  await expect(page).toHaveURL("/connexion");
}

/** From « MON COMPTE » on `app`: « DÉCONNECTER » my other device, confirmed. */
async function revokeMyOtherDevice(app: Page) {
  await app.goto("/compte");
  await expect(devices(app)).toHaveCount(2);
  await devices(app)
    .filter({ hasNotText: "CET APPAREIL" })
    .getByRole("button", { name: "DÉCONNECTER" })
    .click();
  await app
    .getByRole("group")
    .getByRole("button", { name: "DÉCONNECTER" })
    .click();
  await expect(devices(app)).toHaveCount(1);
  await expect(devices(app)).toContainText("CET APPAREIL");
}

const cookie = async (page: Page, name: string) =>
  (await page.context().cookies()).find((found) => found.name === name);

test.describe("mon compte", () => {
  test(
    "ajouter une seconde clé puis se connecter avec",
    { tag: "@passkey" },
    async ({ app, myOtherDevice }) => {
      await virtualAuthenticator(app);
      await addPasskey(app, 1);
      const laptop = await myOtherDevice();
      await virtualAuthenticator(laptop);
      await addPasskey(laptop, 2);

      // Only the laptop's key is on the laptop: it is the one that opens.
      await signOut(laptop);
      await laptop.getByRole("button", { name: "SE CONNECTER" }).click();

      await expect(laptop).toHaveURL("/");
      await laptop.goto("/compte");
      await expect(laptop.getByLabel("TON PRÉNOM")).toHaveValue("Léa");
      await expect(passkeys(laptop)).toHaveCount(2);
    },
  );

  test("déconnecter un autre appareil : il revient sur la connexion", async ({
    app,
    myOtherDevice,
  }) => {
    const laptop = await myOtherDevice();
    await laptop.goto("/list");
    // The proxy's 5-minute session cache: it would still let the laptop in.
    expect(await cookie(laptop, "better-auth.session_data")).toBeDefined();

    await revokeMyOtherDevice(app);

    // At once: its next page, even within the app, goes to the sign-in page.
    await laptop
      .getByRole("navigation", { name: "Navigation principale" })
      .getByRole("link", { name: "SWIPER" })
      .click();
    await expect(laptop).toHaveURL("/connexion");
    await app.goto("/list");
    await expect(app).toHaveURL("/list");
  });

  test("un appareil déconnecté ailleurs, sur une page déjà affichée : sa prochaine action mène à la connexion", async ({
    app,
    myOtherDevice,
  }) => {
    await swipe(app, ["keep"]);
    const laptop = await myOtherDevice();
    await laptop.goto("/list");
    await expect(laptop.getByText("Whiplash")).toBeVisible();

    await revokeMyOtherDevice(app);
    // Still on the page it shows: only its next action finds out.
    await laptop.getByRole("button", { name: "Retirer Whiplash" }).click();

    await expect(laptop).toHaveURL("/connexion");
    await app.goto("/list");
    await expect(app.getByText("Whiplash")).toBeVisible();
  });

  test("supprimer son compte : ses films restent, attribués à un ancien membre", async ({
    app,
    member,
  }) => {
    const hugo = await member("Hugo");
    await swipe(app, ["keep"]);
    await hugo.goto("/list");
    await expect(hugo.getByText("voulu par Léa")).toBeVisible();

    await app.goto("/compte");
    await app.getByRole("button", { name: "SUPPRIMER MON COMPTE" }).click();
    await app.getByLabel("TAPE « Léa » POUR CONFIRMER").fill("Léa");
    await app.getByRole("button", { name: "SUPPRIMER DÉFINITIVEMENT" }).click();

    await expect(app).toHaveURL("/connexion");
    await app.goto("/");
    await expect(app).toHaveURL("/connexion");
    expect(await accountNames()).toEqual(["Hugo"]);
    await hugo.goto("/list");
    await expect(listTitles(hugo)).toHaveText(["Whiplash"]);
    await expect(hugo.getByText(/ajouté par un ancien membre/)).toBeVisible();
    await expect(hugo.getByText("voulu par Léa")).toHaveCount(0);
  });

  test(
    "après déconnexion, un nouveau compte ne voit pas le groupe précédent",
    { tag: "@passkey" },
    async ({ visitor }) => {
      await signUpAs(visitor, "Léa");
      await visitor.getByLabel("NOM DU GROUPE").fill("Ciné club");
      await visitor.getByRole("button", { name: "CRÉER LE GROUPE" }).click();
      await expect(
        visitor.getByRole("button", { name: "Groupe affiché : Ciné club" }),
      ).toBeVisible();
      expect(await cookie(visitor, "ww_group")).toBeDefined();

      await signOut(visitor);
      expect(await cookie(visitor, "ww_group")).toBeUndefined();
      await signUpAs(visitor, "Zoé");

      await expect(
        visitor.getByRole("heading", { name: "CRÉER TON PREMIER GROUPE" }),
      ).toBeVisible();
      await expect(visitor.getByText("Ciné club")).toHaveCount(0);
    },
  );
});
