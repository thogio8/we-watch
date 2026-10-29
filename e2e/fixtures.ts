import {
  type BrowserContext,
  expect,
  type Page,
  test as base,
} from "@playwright/test";
import { testUtils } from "better-auth/plugins";
import { sql } from "drizzle-orm";
import { createAuth } from "../src/auth/create-auth";
import {
  account,
  passkey,
  session,
  signupTicketUse,
  user,
  verification,
} from "../src/db/auth-schema";
import { createDatabase } from "../src/db/create-database";
import {
  group,
  groupMovie,
  membership,
  movieRejection,
  movieSnapshot,
  movieWant,
} from "../src/db/group-schema";
import { movies } from "../src/db/schema";
import { GROUP_COOKIE } from "../src/domain/group";
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

/**
 * Empties the worker's database (lists, groups, movies and every Better Auth
 * table), the children before the rows they point to.
 */
async function wipe() {
  for (const table of [
    movieWant,
    movieRejection,
    groupMovie,
    membership,
    group,
    movieSnapshot,
    movies,
    passkey,
    session,
    account,
    verification,
    signupTicketUse,
    user,
  ]) {
    await db().delete(table);
  }
}

/** Léa's group in every `app` test, joined by each `member`. */
const LEAS_GROUP = { id: "groupe-e2e", name: "NOUS DEUX" };

/** Deletes every session of the worker's database, as a sign-out elsewhere would. */
export async function deleteSessions() {
  await db().delete(session);
}

/**
 * Signs `name` in without a passkey ceremony: a user and a session written
 * straight to the worker's database, their cookies given to the browser.
 * They join `group` (created by its first member), displayed through its
 * cookie; `group: null` leaves them a newcomer without any group.
 */
async function signIn(
  page: Page,
  {
    name = "Léa",
    group: joined = LEAS_GROUP,
  }: { name?: string; group?: typeof LEAS_GROUP | null } = {},
) {
  const worker = base.info().parallelIndex;
  const auth = createAuth({
    db: db(),
    secret: E2E_AUTH_SECRET,
    baseURL: appUrl(worker),
    plugins: [testUtils()],
  });
  const { test: helpers } = await auth.$context;
  const account = await helpers.saveUser(helpers.createUser({ name }));
  const cookies = await helpers.getCookies({
    userId: account.id,
    domain: "localhost",
  });
  if (joined === null) {
    await page.context().addCookies(cookies);
    return;
  }
  await db().insert(group).values(joined).onConflictDoNothing();
  await db()
    .insert(membership)
    .values({ groupId: joined.id, userId: account.id });
  await page.context().addCookies([
    ...cookies,
    // The e2e server runs in production mode over http: not `secure`.
    {
      name: GROUP_COOKIE,
      value: joined.id,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    },
  ]);
}

/** Names of the accounts in the worker's database. */
export async function accountNames() {
  const rows = await db().select({ name: user.name }).from(user);
  return rows.map(({ name }) => name);
}

/**
 * Gives the page a device that unlocks passkeys: a virtual platform
 * authenticator (Chromium, through CDP) that keeps its passkeys and always
 * says yes.
 * Returns how to take it away again.
 */
async function virtualAuthenticator(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send(
    "WebAuthn.addVirtualAuthenticator",
    {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    },
  );
  return async () => {
    await cdp.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
    await cdp.send("WebAuthn.disable");
    await cdp.detach();
  };
}

/**
 * `app`: every test starts signed in as Léa, on the empty list of « NOUS
 * DEUX », on its worker's server. `member(name)`: another member of that
 * group, signed in on a second device (its own browser context).
 * `newcomer`: signed in, but in no group yet. `visitor`: an empty database,
 * no session, a device that unlocks passkeys.
 */
export const test = base.extend<{
  app: Page;
  member: (name: string) => Promise<Page>;
  newcomer: Page;
  visitor: Page;
}>({
  baseURL: async ({}, use, testInfo) => {
    await use(appUrl(testInfo.parallelIndex));
  },
  app: async ({ page }, use) => {
    await wipe();
    await signIn(page);
    await use(page);
  },
  // Needs `app`: Léa's group exists, and the wipe never runs after a member.
  member: async ({ app, baseURL }, use) => {
    const devices: BrowserContext[] = [];
    await use(async (name) => {
      const device = await app.context().browser()!.newContext({ baseURL });
      devices.push(device);
      const page = await device.newPage();
      await signIn(page, { name });
      return page;
    });
    for (const device of devices) {
      await device.close();
    }
  },
  newcomer: async ({ page }, use) => {
    await wipe();
    await signIn(page, { group: null });
    await use(page);
  },
  visitor: async ({ page }, use) => {
    await wipe();
    const removeAuthenticator = await virtualAuthenticator(page);
    await use(page);
    await removeAuthenticator();
  },
});

export { expect };

/** Fills the « CRÉER UN COMPTE » form of /connexion and submits it. */
export async function signUpAs(page: Page, name: string) {
  await page.goto("/connexion");
  await page.getByRole("button", { name: "CRÉER UN COMPTE" }).click();
  await page.getByLabel("TON PRÉNOM OU SURNOM").fill(name);
  await page.getByRole("button", { name: "CRÉER MON COMPTE" }).click();
}

/** What /connexion shows in a browser that cannot do passkeys. */
export const UNSUPPORTED_MESSAGE =
  "CE NAVIGATEUR NE GÈRE PAS LES CLÉS D’ACCÈS. METS-LE À JOUR OU ESSAIE UN AUTRE APPAREIL.";

/** From the next navigation on, the page is a browser without WebAuthn. */
export async function withoutPasskeys(page: Page) {
  await page.addInitScript(() => {
    delete (window as { PublicKeyCredential?: unknown }).PublicKeyCredential;
  });
}

/** Submits the form with an empty name and waits for the refusal. */
export async function emptyNameRefused(page: Page) {
  await signUpAs(page, "");
  await expect(page.getByText("UN PRÉNOM DE 1 À 30 CARACTÈRES")).toBeVisible();
}

/** The card on top of the swipe deck. */
export const topCard = (page: Page) =>
  page
    .getByRole("region", { name: "Film à trier" })
    .getByRole("heading", { level: 2 });

const BUTTONS = { keep: "ON LE VEUT ♥", reject: "✕ BOF" } as const;
type Decision = keyof typeof BUTTONS;

/**
 * Decides the cards in deck order (the fake TMDB: Whiplash, Le Voyage de
 * Chihiro, Parasite, Amélie, Inception), waiting for each one to leave.
 */
export async function swipe(page: Page, decisions: Decision[]) {
  await page.goto("/swipe");
  for (const decision of decisions) {
    await decide(page, decision);
  }
  await settled(page);
}

/** Decides the card on top of the deck already on screen. */
export async function decide(page: Page, decision: Decision) {
  const title = (await topCard(page).textContent()) ?? "";
  await page.getByRole("button", { name: BUTTONS[decision] }).click();
  // Gone, whether another card replaced it or the deck ran out.
  await expect(topCard(page).filter({ hasText: title })).toHaveCount(0);
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
    .update(groupMovie)
    .set({
      decidedAt: sql`${groupMovie.decidedAt} - (select max(${groupMovie.decidedAt}) from ${groupMovie}) + ${date.getTime()}`,
    });
}
