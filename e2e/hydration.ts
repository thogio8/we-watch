import { type Page } from "@playwright/test";

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
  return async () => release();
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
      for (const post of held.splice(0)) post();
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
  return () =>
    page.evaluate(() =>
      (
        window as unknown as { releaseScheduler: () => void }
      ).releaseScheduler(),
    );
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
