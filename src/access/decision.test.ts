import { beforeAll, describe, expect, it } from "vitest";
import { accessDecision, type AccessDecision } from "./decision";
import { createAccessToken } from "./token";

const CODE = "popcorn";
let valid: string;
let stale: string;

beforeAll(async () => {
  valid = await createAccessToken(CODE);
  stale = await createAccessToken("ancien-code");
});

type CookieKind = "absent" | "invalide" | "périmé" | "valide";

function cookieFor(kind: CookieKind): string | undefined {
  switch (kind) {
    case "absent":
      return undefined;
    case "invalide":
      return "n-importe-quoi";
    case "périmé":
      return stale;
    case "valide":
      return valid;
  }
}

const cases: [string, string, CookieKind, AccessDecision][] = [
  // Pages
  ["/", "GET", "absent", "redirect"],
  ["/", "GET", "invalide", "redirect"],
  ["/", "GET", "périmé", "redirect"],
  ["/", "GET", "valide", "allow"],
  ["/swipe", "GET", "absent", "redirect"],
  ["/list", "HEAD", "absent", "redirect"],
  ["/list", "GET", "valide", "allow"],
  // Server Actions are POSTs to the page route
  ["/", "POST", "absent", "unauthorized"],
  ["/swipe", "POST", "invalide", "unauthorized"],
  ["/list", "POST", "périmé", "unauthorized"],
  ["/list", "POST", "valide", "allow"],
  // The unlock page and its own Server Action
  ["/unlock", "GET", "absent", "allow"],
  ["/unlock", "POST", "absent", "allow"],
  ["/unlock/autre", "GET", "absent", "redirect"],
  ["/unlocked", "GET", "absent", "redirect"],
  // Framework assets
  ["/_next/static/chunks/app.js", "GET", "absent", "allow"],
  ["/_next/static/media/archivo.woff2", "GET", "absent", "allow"],
  ["/_next/image", "GET", "absent", "allow"],
  // Static files from public/
  ["/tmdb-logo.svg", "GET", "absent", "allow"],
  ["/favicon.ico", "GET", "absent", "allow"],
  // PWA: iOS fetches these without cookies
  ["/manifest.webmanifest", "GET", "absent", "allow"],
  ["/icon/32", "GET", "absent", "allow"],
  ["/icon/512", "GET", "absent", "allow"],
  ["/apple-icon", "GET", "absent", "allow"],
  ["/maskable-icon", "GET", "absent", "allow"],
  ["/iconographie", "GET", "absent", "redirect"],
  ["/apple-icons", "GET", "absent", "redirect"],
  // A static extension does not open a POST
  ["/tmdb-logo.svg", "POST", "absent", "unauthorized"],
];

describe("accessDecision", () => {
  it.each(cases)(
    "%s en %s avec un cookie %s → %s",
    async (pathname, method, cookie, expected) => {
      await expect(
        accessDecision({
          pathname,
          method,
          cookie: cookieFor(cookie),
          code: CODE,
        }),
      ).resolves.toBe(expected);
    },
  );
});
