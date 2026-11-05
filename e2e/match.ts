import { type Locator, type Page } from "@playwright/test";
import { CONTINUE } from "../src/features/swipe/messages";
import { expect } from "./fixtures";

/** The match moment, a dialog named after its stamp « C’EST UN MATCH ». */
export const matchMoment = (page: Page) =>
  page.getByRole("dialog", { name: /C’EST UN\s*MATCH/ });

/** The deck's region (its cards and their banners). */
export const deck = (page: Page) =>
  page.getByRole("region", { name: "Film à trier" });

/** The small « ♥♥ MATCH » stamp, inside `scope`. */
export const smallMatchStamp = (scope: Page | Locator) =>
  scope.getByText(/^♥♥\s*MATCH$/);

/** The list row of `title`, in the tab on screen. */
export const listRow = (page: Page, title: string) =>
  page
    .getByRole("tabpanel")
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { level: 2, name: title }) });

/** « ON LE VEUT ♥ » on the card on top: my keep makes the match. */
export async function keepToMatch(page: Page) {
  await page.getByRole("button", { name: "ON LE VEUT ♥" }).click();
  await expect(matchMoment(page)).toBeVisible();
}

/** « CONTINUER ▸ »: the moment closes. */
export async function closeMatch(page: Page) {
  await matchMoment(page).getByRole("button", { name: CONTINUE }).click();
  await expect(matchMoment(page)).toHaveCount(0);
}
