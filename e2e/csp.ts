import { type BrowserContext, expect } from "@playwright/test";

const VIOLATION = "CSP violation:";

/**
 * Watches every page of `context` for what a tightened surface could break
 * silently: a Content-Security-Policy violation (the browser's own console
 * message, and the `securitypolicyviolation` event, reported to the console
 * by an init script) or an /api/auth/* call answered 404 (a path missing
 * from AUTH_PATHS). Returns the check to run once the test is done.
 */
export async function watchSecurity(context: BrowserContext) {
  const problems: string[] = [];
  await context.addInitScript((prefix) => {
    document.addEventListener(
      "securitypolicyviolation",
      (event) => {
        console.error(
          `${prefix} ${event.effectiveDirective} ${event.blockedURI}`,
        );
      },
      true,
    );
  }, VIOLATION);
  context.on("console", (message) => {
    const text = message.text();
    if (text.startsWith(VIOLATION) || /Content Security Policy/i.test(text)) {
      problems.push(text);
    }
  });
  context.on("response", (response) => {
    const { pathname } = new URL(response.url());
    if (pathname.startsWith("/api/auth/") && response.status() === 404) {
      problems.push(`404 ${pathname}`);
    }
  });
  return () => {
    expect(problems, "CSP violations or unknown auth paths").toEqual([]);
  };
}
