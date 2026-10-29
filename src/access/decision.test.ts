import { describe, expect, it } from "vitest";
import { accessDecision, type AccessDecision } from "./decision";

type Session = "sans session" | "avec session";

const cases: [string, string, Session, AccessDecision][] = [
  // Pages
  ["/", "GET", "sans session", "redirect"],
  ["/", "GET", "avec session", "allow"],
  ["/swipe", "GET", "sans session", "redirect"],
  ["/list", "HEAD", "sans session", "redirect"],
  ["/list", "GET", "avec session", "allow"],
  ["/list/496243", "GET", "sans session", "redirect"],
  // Server Actions are POSTs to the page route
  ["/", "POST", "sans session", "unauthorized"],
  ["/swipe", "POST", "sans session", "unauthorized"],
  ["/list", "POST", "sans session", "unauthorized"],
  ["/list", "POST", "avec session", "allow"],
  // The sign-in page and its own Server Actions
  ["/connexion", "GET", "sans session", "allow"],
  ["/connexion", "POST", "sans session", "allow"],
  ["/connexion", "GET", "avec session", "allow"],
  ["/connexion/autre", "GET", "sans session", "redirect"],
  ["/connexions", "GET", "sans session", "redirect"],
  // The old access-code screen is gone: it is just another page
  ["/unlock", "GET", "sans session", "redirect"],
  ["/unlock", "POST", "sans session", "unauthorized"],
  // Better Auth's endpoints: signing in happens there
  [
    "/api/auth/passkey/generate-authenticate-options",
    "GET",
    "sans session",
    "allow",
  ],
  [
    "/api/auth/passkey/generate-authenticate-options",
    "POST",
    "sans session",
    "allow",
  ],
  ["/api/auth/passkey/verify-registration", "POST", "sans session", "allow"],
  ["/api/auth/get-session", "GET", "sans session", "allow"],
  ["/api/auth", "GET", "sans session", "redirect"],
  ["/api/authentification", "POST", "sans session", "unauthorized"],
  // Framework assets
  ["/_next/static/chunks/app.js", "GET", "sans session", "allow"],
  ["/_next/static/media/archivo.woff2", "GET", "sans session", "allow"],
  ["/_next/image", "GET", "sans session", "allow"],
  // Static files from public/
  ["/tmdb-logo.svg", "GET", "sans session", "allow"],
  ["/favicon.ico", "GET", "sans session", "allow"],
  // PWA: iOS fetches these without cookies
  ["/manifest.webmanifest", "GET", "sans session", "allow"],
  ["/icon/32", "GET", "sans session", "allow"],
  ["/icon/512", "GET", "sans session", "allow"],
  ["/apple-icon", "GET", "sans session", "allow"],
  ["/maskable-icon", "GET", "sans session", "allow"],
  ["/iconographie", "GET", "sans session", "redirect"],
  ["/apple-icons", "GET", "sans session", "redirect"],
  // A static extension does not open a POST
  ["/tmdb-logo.svg", "POST", "sans session", "unauthorized"],
];

describe("accessDecision", () => {
  it.each(cases)("%s en %s %s → %s", (pathname, method, session, expected) => {
    expect(
      accessDecision({
        pathname,
        method,
        signedIn: session === "avec session",
      }),
    ).toBe(expected);
  });
});

describe("accessDecision : route du cron", () => {
  const SECRET = "un-secret-de-cron-assez-long";
  const request = (
    method: string,
    authorization: string | null,
    cronSecret: string | undefined = SECRET,
  ) =>
    accessDecision({
      pathname: "/api/cron/refresh-movies",
      method,
      signedIn: true,
      authorization,
      cronSecret,
    });

  it("le bon secret ouvre la route en GET", () => {
    expect(request("GET", `Bearer ${SECRET}`)).toBe("allow");
  });

  it("une session seule ne suffit pas, et jamais de redirection", () => {
    expect(request("GET", null)).toBe("unauthorized");
    expect(request("GET", "Bearer faux")).toBe("unauthorized");
  });

  it("refuse un POST et une route sans secret configuré", () => {
    expect(request("POST", `Bearer ${SECRET}`)).toBe("unauthorized");
    expect(request("GET", "Bearer undefined", undefined)).toBe("unauthorized");
  });

  it("les autres routes /api restent derrière la session", () => {
    expect(
      accessDecision({
        pathname: "/api/autre",
        method: "GET",
        signedIn: false,
        authorization: `Bearer ${SECRET}`,
        cronSecret: SECRET,
      }),
    ).toBe("redirect");
  });
});
