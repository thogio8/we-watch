import { type Page } from "@playwright/test";
import { box, expect, listTitles, swipe, test } from "./fixtures";
import {
  copyInviteLink,
  createGroup,
  memberRow,
  openMembers,
  pill,
} from "./groups";

// The e2e servers run with SIGNUP=open (e2e/env.ts): the invite-only mode is
// covered by the functional tests (tests/functional/invite-signup.test.ts).

const heading = (page: Page, name: RegExp) =>
  page.getByRole("heading", { name });

// Display titles break into lines; « » hold non-breaking spaces.
const INVITED = /TU ES INVITÉ·E\s+DANS «\s*NOUS DEUX\s*»/;
const ALREADY = /TU ES DÉJÀ\s+DANS «\s*NOUS DEUX\s*»/;
const INVALID = /CE LIEN N’EST\s+PLUS VALABLE/;
const FIRST_GROUP = /CRÉER TON PREMIER GROUPE/;

/** A confirmation ticket, by its question. */
const ticket = (page: Page, question: RegExp) =>
  page.getByRole("group", { name: question });

const TABS = [
  { label: "TIRER", path: "/" },
  { label: "SWIPER", path: "/swipe" },
  { label: "LISTE", path: "/list" },
];

/** Through the navigation, as a tap would (the client cache answers). */
async function visitTabs(page: Page, groupName: string) {
  for (const { label, path } of TABS) {
    await page
      .getByRole("navigation", { name: "Navigation principale" })
      .getByRole("link", { name: label })
      .click();
    await expect(page).toHaveURL(path);
    await expect(pill(page, groupName)).toBeVisible();
  }
}

test.describe("invitations", () => {
  test("Hugo crée son compte par le lien de Léa et voit la liste du groupe", async ({
    app,
    guest,
  }) => {
    await swipe(app, ["keep"]);
    const link = await copyInviteLink(app);
    expect(link).toMatch(/\/invitation\/[A-Za-z0-9_-]{43}$/);

    const hugo = await guest();
    const response = await hugo.goto(link);
    // The token never leaves in a Referer header.
    expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
    await expect(heading(hugo, INVITED)).toBeVisible();
    await hugo.getByRole("button", { name: "CRÉER UN COMPTE" }).click();
    await hugo.getByLabel("TON PRÉNOM OU SURNOM").fill("Hugo");
    await hugo.getByRole("button", { name: "CRÉER MON COMPTE" }).click();

    await expect(hugo).toHaveURL("/");
    await hugo.goto("/list");
    await expect(pill(hugo, "NOUS DEUX")).toBeVisible();
    await expect(listTitles(hugo)).toHaveText(["Whiplash"]);
    await app.reload();
    await expect(memberRow(app, "Hugo")).toBeVisible();
  });

  test("un lien régénéré ne marche plus", async ({ app, outsider }) => {
    const old = await copyInviteLink(app);
    await app.getByRole("button", { name: "RÉGÉNÉRER LE LIEN" }).click();
    await ticket(app, /L’ANCIEN LIEN NE MARCHERA PLUS/)
      .getByRole("button", { name: "RÉGÉNÉRER" })
      .click();
    await expect(
      app.getByRole("button", { name: "RÉGÉNÉRER LE LIEN" }),
    ).toBeVisible();
    const fresh = await copyInviteLink(app);
    expect(fresh).not.toBe(old);

    const hugo = await outsider("Hugo");
    await hugo.goto(old);
    await expect(heading(hugo, INVALID)).toBeVisible();
    await hugo.goto(fresh);
    await expect(heading(hugo, INVITED)).toBeVisible();
    await hugo.getByRole("button", { name: "REJOINDRE" }).click();

    await expect(hugo).toHaveURL("/");
    await expect(pill(hugo, "NOUS DEUX")).toBeVisible();
  });

  test("Léa retire Hugo : il ne voit plus le groupe", async ({
    app,
    member,
  }) => {
    const hugo = await member("Hugo");
    await hugo.goto("/list");
    await expect(pill(hugo, "NOUS DEUX")).toBeVisible();

    await app.goto("/groupe");
    await memberRow(app, "Hugo")
      .getByRole("button", { name: "RETIRER" })
      .click();
    await ticket(app, /RETIRER HUGO DU GROUPE/)
      .getByRole("button", { name: "RETIRER" })
      .click();

    await expect(memberRow(app, "Hugo")).toHaveCount(0);
    await expect(memberRow(app, "Léa")).toBeVisible();
    await hugo.goto("/list");
    await expect(heading(hugo, FIRST_GROUP)).toBeVisible();
  });

  test("le dernier membre quitte : le groupe disparaît, on arrive sur CRÉER TON PREMIER GROUPE", async ({
    app,
  }) => {
    const link = await copyInviteLink(app);
    await app.getByRole("button", { name: "QUITTER LE GROUPE" }).click();
    const leave = ticket(app, /QUITTER «\s*NOUS DEUX\s*»/);
    await expect(leave).toContainText(
      "TU ES LE DERNIER MEMBRE : LE GROUPE ET SA LISTE SERONT SUPPRIMÉS.",
    );
    await leave.getByRole("button", { name: "QUITTER", exact: true }).click();

    await expect(app).toHaveURL("/");
    await expect(heading(app, FIRST_GROUP)).toBeVisible();
    // Gone with the group, its link opens nothing.
    await app.goto(link);
    await expect(heading(app, INVALID)).toBeVisible();
  });

  test("sur un téléphone, le ticket de confirmation s’ouvre au-dessus de la nav", async ({
    app,
    member,
  }) => {
    // The nav sits at the bottom on phones only.
    test.skip(test.info().project.name !== "iphone");
    await member("Hugo");
    await app.goto("/groupe");
    await app.getByRole("button", { name: "QUITTER LE GROUPE" }).click();

    const leave = await box(ticket(app, /QUITTER «\s*NOUS DEUX\s*»/));
    const nav = await box(
      app.getByRole("navigation", { name: "Navigation principale" }),
    );
    expect(leave.y + leave.height).toBeLessThanOrEqual(nav.y);
    await expect(app.getByRole("button", { name: "ANNULER" })).toBeFocused();
  });

  test("un membre déjà dans le groupe qui ouvre le lien y bascule", async ({
    app,
  }) => {
    const link = await copyInviteLink(app);
    await createGroup(app, "Ciné club");

    await app.goto(link);
    await expect(heading(app, ALREADY)).toBeVisible();
    await app.getByRole("button", { name: "Y ALLER" }).click();

    await expect(app).toHaveURL("/");
    await expect(pill(app, "NOUS DEUX")).toBeVisible();
  });

  test("renommer le groupe change la pastille sur TIRER, SWIPER et LISTE", async ({
    app,
  }) => {
    // Visited first, so the client cache holds them with the old name.
    await app.goto("/");
    await visitTabs(app, "NOUS DEUX");

    await openMembers(app);
    await app.getByLabel("NOM DU GROUPE").fill("La coloc");
    await app.getByRole("button", { name: "RENOMMER" }).click();
    await expect(pill(app, "La coloc")).toBeVisible();

    await visitTabs(app, "La coloc");
  });
});
