import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../next.config";

const rules = async () => (await nextConfig.headers?.()) ?? [];

const headersOf = async (source: string) =>
  Object.fromEntries(
    ((await rules()).find((rule) => rule.source === source)?.headers ?? []).map(
      ({ key, value }) => [key, value],
    ),
  );

/** The directives of a Content-Security-Policy, by name. */
const directives = (csp: string) =>
  new Map(
    csp
      .split(";")
      .map((directive) => directive.trim().split(/\s+/))
      .map(([name = "", ...values]) => [name, values]),
  );

const policy = async () =>
  directives((await headersOf("/:path*"))["Content-Security-Policy"] ?? "");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("next.config", () => {
  it("une page d’invitation n’envoie jamais son adresse (le jeton) en Referer", async () => {
    expect(await rules()).toContainEqual({
      source: "/invitation/:token*",
      headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
    });
  });

  it("la règle de l’invitation vient après celle de tout le site (la dernière gagne)", async () => {
    const sources = (await rules()).map(({ source }) => source);

    expect(sources.indexOf("/:path*")).toBe(0);
    expect(sources.indexOf("/invitation/:token*")).toBeGreaterThan(0);
  });

  it("toute réponse porte les en-têtes de sécurité", async () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(await headersOf("/:path*")).toEqual({
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://image.tmdb.org; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Permissions-Policy":
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
      "Strict-Transport-Security": "max-age=63072000",
    });
  });

  it("'unsafe-eval' seulement en développement (les piles d’erreur de React)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect((await policy()).get("script-src")).toContain("'unsafe-eval'");

    vi.stubEnv("NODE_ENV", "production");
    expect((await policy()).get("script-src")).not.toContain("'unsafe-eval'");
  });

  it("chaque hôte d’images autorisé par next/image l’est aussi par la CSP", async () => {
    const imgSrc = (await policy()).get("img-src");

    for (const pattern of nextConfig.images?.remotePatterns ?? []) {
      expect(imgSrc).toContain(
        `${(pattern as { protocol: string }).protocol}://${pattern.hostname}`,
      );
    }
  });

  it("ni cadre, ni plugin, ni envoi de formulaire ailleurs", async () => {
    const csp = await policy();

    expect(csp.get("frame-ancestors")).toEqual(["'none'"]);
    expect(csp.get("frame-src")).toEqual(["'none'"]);
    expect(csp.get("object-src")).toEqual(["'none'"]);
    expect(csp.get("form-action")).toEqual(["'self'"]);
    expect(csp.get("connect-src")).toEqual(["'self'"]);
  });
});
