import { type Page } from "@playwright/test";
import { expect } from "./fixtures";

/** The pill naming the group on screen. */
export const pill = (page: Page, name: string | RegExp = /.*/) =>
  page.getByRole("button", {
    name: typeof name === "string" ? `Groupe affiché : ${name}` : name,
  });

const panel = (page: Page) => page.getByRole("dialog", { name: "TES GROUPES" });

export async function openPanel(page: Page) {
  await pill(page, /^Groupe affiché/).click();
  await expect(panel(page)).toBeVisible();
}

/** « + CRÉER UN GROUPE » in the pill's panel: the new group is displayed. */
export async function createGroup(page: Page, name: string) {
  await openPanel(page);
  // Scoped: on « MEMBRES ET INVITATION », a rename field has the same label.
  await panel(page).getByRole("button", { name: "+ CRÉER UN GROUPE" }).click();
  await panel(page).getByLabel("NOM DU GROUPE").fill(name);
  await panel(page).getByRole("button", { name: "CRÉER LE GROUPE" }).click();
  await expect(pill(page, name)).toBeVisible();
}

/** Picks another group in the pill's panel. */
export async function chooseGroup(page: Page, name: string) {
  await openPanel(page);
  await panel(page)
    .getByRole("button", { name: new RegExp(`^${name}`) })
    .click();
  await expect(pill(page, name)).toBeVisible();
}

export const COPY_LINK = "COPIER LE LIEN D’INVITATION";

/**
 * « MEMBRES ET INVITATION », from the pill's panel of the page on screen,
 * once its invite link has come (the copy button waits for it).
 */
export async function openMembers(page: Page) {
  await openPanel(page);
  await page.getByRole("link", { name: "MEMBRES ET INVITATION" }).click();
  await membersReady(page);
}

async function membersReady(page: Page) {
  await expect(page).toHaveURL("/groupe");
  await expect(page.getByRole("button", { name: COPY_LINK })).toBeEnabled();
}

/** The displayed group's invite link, copied from its members screen. */
export async function copyInviteLink(page: Page) {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/groupe");
  await membersReady(page);
  await page.getByRole("button", { name: COPY_LINK }).click();
  await expect(page.getByText("LIEN COPIÉ")).toBeVisible();
  return page.evaluate(() => navigator.clipboard.readText());
}

/** A members row of the screen « MEMBRES ET INVITATION ». */
export const memberRow = (page: Page, name: string) =>
  page.getByRole("list", { name: "MEMBRES" }).getByRole("listitem", { name });
