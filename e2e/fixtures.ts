import { expect, type Page, test as base } from "@playwright/test";
import { sql } from "drizzle-orm";
import { createDatabase } from "../src/db/create-database";
import { movies } from "../src/db/schema";
import { ACCESS_CODE, E2E_DATABASE } from "./env";

const db = createDatabase(`file:${E2E_DATABASE}`);

/** Every test starts unlocked, on an empty list. */
export const test = base.extend<{ app: Page }>({
  app: async ({ page }, use) => {
    await db.delete(movies);
    await unlock(page);
    await use(page);
  },
});

export { expect };

export async function enterCode(page: Page, code: string) {
  await page.goto("/unlock");
  await page.getByLabel("Code d'accès").fill(code);
  await page.getByRole("button", { name: "ENTRER" }).click();
}

/** Enters the right code and waits for the cookie (the redirect home). */
export async function unlock(page: Page) {
  await enterCode(page, ACCESS_CODE);
  await page.waitForURL("/");
}

/** The card on top of the swipe deck. */
export const topCard = (page: Page) =>
  page
    .getByRole("region", { name: "Film à trier" })
    .getByRole("heading", { level: 2 });

const BUTTONS = { keep: "ON LE VEUT ♥", reject: "✕ BOF" } as const;

/**
 * Decides the cards in deck order (the fake TMDB: Whiplash, Le Voyage de
 * Chihiro, Parasite, Amélie, Inception), waiting for each one to leave.
 */
export async function swipe(page: Page, decisions: (keyof typeof BUTTONS)[]) {
  await page.goto("/swipe");
  for (const decision of decisions) {
    const title = (await topCard(page).textContent()) ?? "";
    await page.getByRole("button", { name: BUTTONS[decision] }).click();
    // Gone, whether another card replaced it or the deck ran out.
    await expect(topCard(page).filter({ hasText: title })).toHaveCount(0);
  }
  await settled(page);
}

/** Waits for the Server Actions in flight (saves run behind the UI). */
export async function settled(page: Page) {
  await page.waitForLoadState("networkidle");
}

/** Titles shown in the current list tab. */
export const listTitles = (page: Page) =>
  page.getByRole("tabpanel").getByRole("heading", { level: 2 });

/**
 * Moves the list's dates to `date` (the latest one lands on it), keeping
 * their order: the server stamps them with today.
 */
export async function decidedOn(date: Date) {
  await db.update(movies).set({
    decidedAt: sql`${movies.decidedAt} - (select max(${movies.decidedAt}) from ${movies}) + ${date.getTime()}`,
  });
}
