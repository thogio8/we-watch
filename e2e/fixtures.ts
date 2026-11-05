import {
  type Browser,
  type BrowserContext,
  expect,
  type Locator,
  type Page,
  test as base,
} from "@playwright/test";
import { testUtils } from "better-auth/plugins";
import { eq, isNotNull, sql } from "drizzle-orm";
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
import { createRateLimits } from "../src/db/rate-limit";
import { rateLimit } from "../src/db/rate-limit-schema";
import {
  group,
  groupMovie,
  membership,
  movieRejection,
  movieSnapshot,
  movieWant,
} from "../src/db/group-schema";
import { GROUP_COOKIE } from "../src/domain/group";
import { watchSecurity } from "./csp";
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
 * Empties the worker's database (lists, groups, movies, every Better Auth
 * table and the attempt counters), the children before the rows they point
 * to.
 */
async function wipe() {
  for (const table of [
    movieWant,
    movieRejection,
    groupMovie,
    membership,
    group,
    movieSnapshot,
    passkey,
    session,
    account,
    verification,
    signupTicketUse,
    user,
    rateLimit,
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

/** Better Auth's test helpers, on the worker's database and server. */
async function authHelpers() {
  const worker = base.info().parallelIndex;
  const auth = createAuth({
    db: db(),
    secret: E2E_AUTH_SECRET,
    baseURL: appUrl(worker),
    rateLimits: createRateLimits(db()),
    plugins: [testUtils()],
  });
  return (await auth.$context).test;
}

/** A session of `userId`'s, written to the worker's database: its cookies. */
async function sessionCookies(userId: string) {
  return (await authHelpers()).getCookies({ userId, domain: "localhost" });
}

/** The cookie of the group displayed on the device. */
const groupCookie = (groupId: string) => ({
  name: GROUP_COOKIE,
  value: groupId,
  domain: "localhost",
  path: "/",
  httpOnly: true,
  sameSite: "Lax" as const,
  // The e2e server runs in production mode over http: not `secure`.
  secure: false,
});

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
  const helpers = await authHelpers();
  const account = await helpers.saveUser(helpers.createUser({ name }));
  const cookies = await sessionCookies(account.id);
  if (joined === null) {
    await page.context().addCookies(cookies);
    return;
  }
  await db().insert(group).values(joined).onConflictDoNothing();
  await db()
    .insert(membership)
    .values({ groupId: joined.id, userId: account.id });
  await page.context().addCookies([...cookies, groupCookie(joined.id)]);
}

/** Léa's id in the worker's database. */
async function leasId() {
  const [lea] = await db()
    .select({ id: user.id })
    .from(user)
    .where(eq(user.name, "Léa"));
  return lea!.id;
}

/** Léa again, on another device: a session of her own, « NOUS DEUX » shown. */
async function signInLeaAgain(page: Page) {
  await page
    .context()
    .addCookies([
      ...(await sessionCookies(await leasId())),
      groupCookie(LEAS_GROUP.id),
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
 * Returns how to take it away again; it also goes with its browser context.
 */
export async function virtualAuthenticator(page: Page) {
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
 * Lends the test second devices, each its own browser context set up by
 * `setUp`, closed at its end. The runner gives every context of the test the
 * project's options (device, locale, time zone, reduced motion, baseURL), as
 * it does `page`'s.
 */
async function secondDevices(
  browser: Browser,
  use: (
    open: (setUp: (page: Page) => Promise<unknown>) => Promise<Page>,
  ) => Promise<void>,
) {
  const devices: BrowserContext[] = [];
  const checks: (() => void)[] = [];
  await use(async (setUp) => {
    const device = await browser.newContext();
    devices.push(device);
    checks.push(await watchSecurity(device));
    const page = await device.newPage();
    await setUp(page);
    return page;
  });
  for (const device of devices) {
    await device.close();
  }
  for (const check of checks) {
    check();
  }
}

/**
 * `app`: every test starts signed in as Léa, on the empty list of « NOUS
 * DEUX », on its worker's server. On second devices, besides Léa's:
 * `member(name)`, another member of that group; `myOtherDevice()`, Léa
 * again, with a session of her own; `outsider(name)`, signed in
 * but in no group; `guest()`, signed out, with a device that unlocks
 * passkeys. `newcomer`: signed in, but in no group yet. `visitor`: an empty
 * database, no session, a device that unlocks passkeys.
 */
export const test = base.extend<{
  app: Page;
  member: (name: string) => Promise<Page>;
  myOtherDevice: () => Promise<Page>;
  outsider: (name: string) => Promise<Page>;
  guest: () => Promise<Page>;
  newcomer: Page;
  visitor: Page;
}>({
  baseURL: async ({}, use, testInfo) => {
    await use(appUrl(testInfo.parallelIndex));
  },
  // Every test fails on a CSP violation or an unknown auth path (e2e/csp.ts).
  context: async ({ context }, use) => {
    const check = await watchSecurity(context);
    await use(context);
    check();
  },
  app: async ({ page }, use) => {
    await wipe();
    await signIn(page);
    await use(page);
  },
  // Needs `app` (`app: {}`, used for its setup only): Léa's group exists, and
  // the wipe never runs after a second device.
  member: async ({ app: {}, browser }, use) => {
    await secondDevices(browser, (open) =>
      use((name) => open((page) => signIn(page, { name }))),
    );
  },
  myOtherDevice: async ({ app: {}, browser }, use) => {
    await secondDevices(browser, (open) => use(() => open(signInLeaAgain)));
  },
  outsider: async ({ app: {}, browser }, use) => {
    await secondDevices(browser, (open) =>
      use((name) => open((page) => signIn(page, { name, group: null }))),
    );
  },
  // The authenticator goes with its context.
  guest: async ({ app: {}, browser }, use) => {
    await secondDevices(browser, (open) =>
      use(() => open(virtualAuthenticator)),
    );
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

/**
 * Moves every favourite's date to `date`: the server stamps them with today,
 * and the movie page shows « coup de cœur de Léa le … ».
 */
export async function favoritedOn(date: Date) {
  await db()
    .update(groupMovie)
    .set({ favoriteAt: date })
    .where(isNotNull(groupMovie.favoriteAt));
}

/** The ♡ / ♥ button of a film, on its list row or on its page's poster. */
export const heart = (page: Page, title: string) =>
  page.getByRole("button", { name: `Coup de cœur\u00A0: ${title}` });

/** Marks `title` from the list, once the page brings its ♥ back. */
export async function markFromList(page: Page, title: string) {
  await page.goto("/list");
  await heart(page, title).click();
  await expect(heart(page, title)).toHaveAttribute("aria-pressed", "true");
  await settled(page);
}

/**
 * Moves the members' arrivals to `date` (the latest one lands on it), keeping
 * their order: the members screen shows « depuis le … », oldest first.
 */
export async function joinedOn(date: Date) {
  await db()
    .update(membership)
    .set({
      joinedAt: sql`${membership.joinedAt} - (select max(${membership.joinedAt}) from ${membership}) + ${date.getTime()}`,
    });
}

/** A fixed, well-formed token (43 base64url characters) for captures. */
const LEAS_INVITE = "invitation-e2e_".padEnd(43, "0");

/**
 * The path of an invite link to Léa's group, its token written in the
 * database (the screens never show it): for the screens that only need one.
 */
export async function leasInvitation() {
  await db()
    .update(group)
    .set({ inviteToken: LEAS_INVITE })
    .where(eq(group.id, LEAS_GROUP.id));
  return `/invitation/${LEAS_INVITE}`;
}

/** Where the element is on screen; it must be there. */
export async function box(locator: Locator) {
  const found = await locator.boundingBox();
  expect(found).not.toBeNull();
  return found!;
}

const DAY = 24 * 60 * 60 * 1000;
const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const MAC_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Léa's account as « MON COMPTE » shows it, fixed for captures: this device
 * an iPhone active on `date`, a Mac signed in too, and a passkey of each,
 * added before. Only `updatedAt` moves: Better Auth renews a session on its
 * `expiresAt`, left untouched, so the dates stay put.
 * The captures rely on no session renewal during a run (`updateAge`: 1 day).
 */
export async function leasAccountOn(date: Date) {
  const userId = await leasId();
  await db()
    .update(session)
    .set({ userAgent: IPHONE_SAFARI, updatedAt: date })
    .where(eq(session.userId, userId));
  await db()
    .insert(session)
    .values({
      id: "session-mac-e2e",
      token: "session-mac-e2e-token",
      userId,
      userAgent: MAC_CHROME,
      expiresAt: new Date(Date.now() + 7 * DAY),
      updatedAt: new Date(date.getTime() - 2 * DAY),
    });
  await db()
    .insert(passkey)
    .values(
      [
        { id: "passkey-iphone-e2e", name: "iPhone · Safari", daysBefore: 9 },
        { id: "passkey-mac-e2e", name: "Mac · Chrome", daysBefore: 3 },
      ].map(({ id, name, daysBefore }) => ({
        id,
        name,
        userId,
        publicKey: "key",
        credentialID: id,
        counter: 0,
        deviceType: "multiDevice",
        backedUp: true,
        createdAt: new Date(date.getTime() - daysBefore * DAY),
      })),
    );
}
