import { expect, type Page, test as base } from "@playwright/test";
import { testUtils } from "better-auth/plugins";
import { sql } from "drizzle-orm";
import { createAuth } from "../src/auth/create-auth";
import { passkey, session, user } from "../src/db/auth-schema";
import { createDatabase } from "../src/db/create-database";
import { movies } from "../src/db/schema";
import { appUrl, databaseOf, E2E_AUTH_SECRET } from "./env";

const databases = new Map<number, ReturnType<typeof createDatabase>>();

/** The database of the running test's worker (one per worker, e2e/env.ts). */
function db() {
  const worker = base.info().parallelIndex;
  if (!databases.has(worker)) {
    databases.set(worker, createDatabase(`file:${databaseOf(worker)}`));
  }
  return databases.get(worker)!;
}

/** Empties the worker's database, children before the users they point to. */
async function wipe() {
  await db().delete(movies);
  await db().delete(passkey);
  await db().delete(session);
  await db().delete(user);
}

/** Deletes every session of the worker's database, as a sign-out elsewhere would. */
export async function deleteSessions() {
  await db().delete(session);
}

/**
 * Signs Léa in without a passkey ceremony: a user and a session written
 * straight to the worker's database, their cookies given to the browser.
 */
async function signIn(page: Page) {
  const worker = base.info().parallelIndex;
  const auth = createAuth({
    db: db(),
    secret: E2E_AUTH_SECRET,
    baseURL: appUrl(worker),
    plugins: [testUtils()],
  });
  const { test: helpers } = await auth.$context;
  const lea = await helpers.saveUser(helpers.createUser({ name: "Léa" }));
  await page
    .context()
    .addCookies(
      await helpers.getCookies({ userId: lea.id, domain: "localhost" }),
    );
}

/** Names of the accounts in the worker's database. */
export async function accountNames() {
  const rows = await db().select({ name: user.name }).from(user);
  return rows.map(({ name }) => name);
}

/**
 * Gives the page a device with Face ID: a virtual platform authenticator
 * (Chromium, through CDP) that keeps its passkeys and always says yes.
 */
async function faceId(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
}

/**
 * `app`: every test starts signed in, on an empty list, on its worker's
 * server. `visitor`: an empty database, no session, a device with Face ID.
 */
export const test = base.extend<{ app: Page; visitor: Page }>({
  baseURL: async ({}, use, testInfo) => {
    await use(appUrl(testInfo.parallelIndex));
  },
  app: async ({ page }, use) => {
    await wipe();
    await signIn(page);
    await use(page);
  },
  visitor: async ({ page }, use) => {
    await wipe();
    await faceId(page);
    await use(page);
  },
});

export { expect };

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
  await db()
    .update(movies)
    .set({
      decidedAt: sql`${movies.decidedAt} - (select max(${movies.decidedAt}) from ${movies}) + ${date.getTime()}`,
    });
}
