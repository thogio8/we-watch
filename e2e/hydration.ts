import { expect, type Locator, type Page } from "@playwright/test";

type Release = () => Promise<void>;

/** Chromium: the app's JS chunks wait, the HTML and CSS are on time. */
async function holdChunks(page: Page): Promise<Release> {
  let release = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/_next\/static\/chunks\/.*\.js$/, async (route) => {
    await released;
    await route.continue();
  });
  return async () => {
    release();
    await page.unrouteAll({ behavior: "ignoreErrors" });
  };
}

/**
 * WebKit paints nothing while a chunk is pending, so its chunks pass; then
 * React's scheduler, which posts its work through a MessageChannel, waits:
 * the page is shown, React listens, but the field is not hydrated yet.
 */
async function holdScheduler(page: Page): Promise<Release> {
  await page.addInitScript(() => {
    const held: (() => void)[] = [];
    let released = false;
    const scope = window as unknown as Record<string, unknown>;
    scope.releaseScheduler = () => {
      released = true;
      const posts = held.splice(0);
      for (const post of posts) post();
      return posts.length;
    };
    const Native = MessageChannel;
    scope.MessageChannel = class extends Native {
      constructor() {
        super();
        const port = this.port2;
        const post = port.postMessage.bind(port) as (message: unknown) => void;
        port.postMessage = (message: unknown) => {
          if (released) post(message);
          else held.push(() => post(message));
        };
      }
    };
  });
  return async () => {
    const held = await page.evaluate(() =>
      (
        window as unknown as { releaseScheduler: () => number }
      ).releaseScheduler(),
    );
    // Nothing held: React no longer schedules through a MessageChannel.
    if (held === 0)
      throw new Error("holdHydration: React's scheduler was not held");
  };
}

/**
 * A slow phone: the page is on screen before React has hydrated it, until
 * `release()`, so what is typed meanwhile lands before the field is ready.
 * Call before `goto`.
 */
export function holdHydration(page: Page): Promise<Release> {
  const webkit = page.context().browser()?.browserType().name() === "webkit";
  return webkit ? holdScheduler(page) : holdChunks(page);
}

/**
 * Proves the hold worked: React has not hydrated `field` yet (no props
 * attached). Before typing, since on WebKit the input event hydrates it.
 */
export async function expectNotHydrated(field: Locator) {
  const hydrated = await field.evaluate((element) =>
    Object.keys(element).some((key) => key.startsWith("__reactProps$")),
  );
  expect(hydrated, "the field must not be hydrated yet").toBe(false);
}
