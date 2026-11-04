import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLOSED_ERROR } from "@/features/signin/messages";

// The CI's release job runs this script on production right after putting
// it online, and rolls back when it fails (.github/workflows/ci.yml): here,
// against a fake production that answers like a healthy 2.0.

const SECRET = "smoke-test-cron-secret";
const VERIFY = "/api/auth/passkey/verify-authentication";
const CSP = "default-src 'self'; frame-ancestors 'none'; object-src 'none'";
/** A response body the script must never print, on success or failure. */
const BODY_MARKER = "never-printed-body";
/** What /connexion shows when signup is by invitation only (SIGNUP=invite). */
const INVITE_ONLY = CLOSED_ERROR;
const INVITE_PAGE = `<main>${BODY_MARKER}<p class="note">${INVITE_ONLY}</p></main>`;

type Answer = {
  status: number;
  headers?: Record<string, string>;
  body?: string;
};
type Prod = Record<string, Answer>;

const healthy = (host: string): Prod => ({
  "/connexion": {
    status: 200,
    headers: { "content-security-policy": CSP },
    body: INVITE_PAGE,
  },
  "/": { status: 307, headers: { location: "/connexion" } },
  "/api/auth/passkey/generate-authenticate-options": {
    status: 200,
    body: `{"challenge":"${BODY_MARKER}","rpId":"${host}","userVerification":"preferred"}`,
  },
  "/api/auth/ok": { status: 404, body: BODY_MARKER },
  // Answered to a POST from another origin only (the fake below): Better
  // Auth's origin check refuses it.
  [VERIFY]: { status: 403, body: BODY_MARKER },
  "/api/cron/refresh-movies": {
    status: 200,
    body: '{"total":0,"refreshed":0,"failed":[],"purged":{"sessions":0}}',
  },
});

let prod: Prod;
let requested: string[];
let server: Server;
let url: string;
beforeEach(async () => {
  prod = healthy("127.0.0.1");
  requested = [];
  server = createServer((request, response: ServerResponse) => {
    requested.push(request.url ?? "");
    const cron = request.url === "/api/cron/refresh-movies";
    const authorized = request.headers.authorization === `Bearer ${SECRET}`;
    const crossSite =
      request.method === "POST" && request.headers.origin !== url;
    const answer =
      (cron && !authorized) || (request.url === VERIFY && !crossSite)
        ? { status: 401 }
        : prod[request.url ?? ""];
    if (!answer) return void response.writeHead(404).end();
    response.writeHead(answer.status, answer.headers).end(answer.body);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(() => new Promise((resolve) => server.close(resolve)));

/**
 * Runs the script (async: the fake server lives in this process). No wait
 * for production to switch unless a test asks for one.
 */
async function smoke(
  prodUrl = url,
  expectSignup = "invite",
  wait: Record<string, string> = { SMOKE_READY_TIMEOUT: "0" },
) {
  try {
    const { stdout } = await promisify(execFile)(
      "bash",
      ["scripts/smoke-prod.sh"],
      {
        env: {
          ...process.env,
          PROD_URL: prodUrl,
          CRON_SECRET: SECRET,
          EXPECT_SIGNUP: expectSignup,
          ...wait,
        },
      },
    );
    return { code: 0, printed: stdout };
  } catch (error) {
    const { code, stdout } = error as { code: number; stdout: string };
    return { code, printed: stdout };
  }
}

function expectNothingSecret(printed: string) {
  expect(printed).not.toContain(SECRET);
  expect(printed).not.toContain(BODY_MARKER);
}

describe("test de fumée de la prod", () => {
  it("une prod saine : 8 vérifications vertes, aucun secret affiché", async () => {
    const { code, printed } = await smoke();

    expect(code).toBe(0);
    expect(printed.match(/^✓ /gm)).toHaveLength(8);
    expect(printed).not.toContain("✕");
    expectNothingSecret(printed);
  });

  it("la fumée attend le texte exact que l'écran de connexion affiche sur invitation", () => {
    const script = readFileSync("scripts/smoke-prod.sh", "utf8");

    expect(script).toContain(`invite_only="${CLOSED_ERROR}"`);
  });

  it("SIGNUP ouvert alors que le dépôt attend l'invitation : rouge", async () => {
    prod["/connexion"] = { ...prod["/connexion"]!, body: BODY_MARKER };

    const { code, printed } = await smoke();

    expect(code).toBe(1);
    expect(printed).toContain(
      `✕ /connexion signup: expected ${INVITE_ONLY}, received signup open`,
    );
    expectNothingSecret(printed);
  });

  it("le texte d'invitation se reconnaît malgré des espaces insécables ou des entités", async () => {
    prod["/connexion"] = {
      ...prod["/connexion"]!,
      body: "<p>WEWATCH&nbsp;SE\u00a0REJOINT&#160;SUR&#xA0;INVITATION</p>",
    };

    expect((await smoke()).code).toBe(0);
  });

  it("EXPECT_SIGNUP=open : le mode d'inscription n'est pas vérifié", async () => {
    prod["/connexion"] = { ...prod["/connexion"]!, body: BODY_MARKER };

    const { code, printed } = await smoke(url, "open");

    expect(code).toBe(0);
    expect(printed.match(/^✓ /gm)).toHaveLength(7);
    expect(printed).toContain("signup mode not checked (EXPECT_SIGNUP=open)");
  });

  it("EXPECT_SIGNUP mal saisie : rouge, avant toute requête", async () => {
    const { code, printed } = await smoke(url, "invte");

    expect(code).toBe(1);
    expect(printed).toContain(
      "✕ EXPECT_SIGNUP: expected invite or open, received invte",
    );
    expect(printed).not.toContain("✓");
  });

  it("l'hôte du rpId se tire de PROD_URL, sans schéma, port ni chemin", async () => {
    const { code } = await smoke(`${url}/`);

    expect(code).toBe(0);
  });

  it("le domaine sert encore l'ancienne version juste après la mise en ligne : la fumée l'attend, puis vérifie la nouvelle", async () => {
    const fresh = prod["/connexion"]!;
    prod["/connexion"] = { status: 307, headers: { location: "/unlock" } };
    setTimeout(() => (prod["/connexion"] = fresh), 1500);

    const { code, printed } = await smoke(url, "invite", {
      SMOKE_READY_TIMEOUT: "20",
      SMOKE_READY_INTERVAL: "1",
    });

    expect(code).toBe(0);
    expect(printed.match(/^✓ /gm)).toHaveLength(8);
  });

  it("une version qui ne répond jamais 200 : rouge une fois l'attente finie", async () => {
    prod["/connexion"] = { status: 307, headers: { location: "/unlock" } };

    const { code, printed } = await smoke(url, "invite", {
      SMOKE_READY_TIMEOUT: "2",
      SMOKE_READY_INTERVAL: "1",
    });

    expect(code).toBe(1);
    expect(printed).toContain("✕ /connexion: expected 200, received 307");
  });

  it("une prod injoignable : rouge, avec un message", async () => {
    const { code, printed } = await smoke("http://127.0.0.1:1");

    expect(code).toBe(1);
    expect(printed).toContain("✕ /connexion: expected 200, received 000");
  });

  it("un rpId d'un autre hôte : rouge, attendu et reçu affichés", async () => {
    prod = healthy("wewatch.example");

    const { code, printed } = await smoke();

    expect(code).toBe(1);
    expect(printed).toContain('expected "rpId":"127.0.0.1"');
    expect(printed).toContain('received "rpId":"wewatch.example"');
    expectNothingSecret(printed);
  });

  it("la route des options de connexion en panne : rouge, avec son statut", async () => {
    prod["/api/auth/passkey/generate-authenticate-options"] = {
      status: 500,
      body: BODY_MARKER,
    };

    const { code, printed } = await smoke();

    expect(code).toBe(1);
    expect(printed).toMatch(/expected 200 .*, received 500/);
    expectNothingSecret(printed);
  });

  it("/ ne renvoie plus vers /connexion : rouge", async () => {
    prod["/"] = { status: 200, body: BODY_MARKER };

    const { code, printed } = await smoke();

    expect(code).toBe(1);
    expect(printed).toContain("expected 307 …/connexion, received 200 (none)");
    expectNothingSecret(printed);
  });

  it("une CSP perdue (next.config) : rouge", async () => {
    prod["/connexion"] = { status: 200, body: BODY_MARKER };

    const { code, printed } = await smoke();

    expect(code).toBe(1);
    expect(printed).toContain("received (no content-security-policy)");
  });

  it("une CSP sans frame-ancestors 'none' : rouge, la CSP reçue affichée", async () => {
    prod["/connexion"] = {
      status: 200,
      headers: { "content-security-policy": "default-src 'self'" },
    };

    const { code, printed } = await smoke();

    expect(code).toBe(1);
    expect(printed).toContain("received default-src 'self'");
  });

  it("un chemin d'auth inutilisé qui répond encore : rouge", async () => {
    prod["/api/auth/ok"] = { status: 200, body: BODY_MARKER };

    const { code, printed } = await smoke();

    expect(code).toBe(1);
    expect(printed).toContain("expected 404, received 200");
    expectNothingSecret(printed);
  });

  it("le contrôle d'origine de Better Auth coupé (variable TEST) : rouge", async () => {
    prod[VERIFY] = { status: 400, body: BODY_MARKER };

    const { code, printed } = await smoke();

    expect(code).toBe(1);
    expect(printed).toContain("expected 403, received 400");
    expectNothingSecret(printed);
  });

  it("un rafraîchissement en 500 (ménage ou base cassés) : rouge", async () => {
    prod["/api/cron/refresh-movies"] = { status: 500, body: BODY_MARKER };

    const { code, printed } = await smoke();

    expect(code).toBe(1);
    expect(printed).toContain("expected 200, received 500");
    expectNothingSecret(printed);
  });

  it("des films en échec au rafraîchissement : rouge", async () => {
    prod["/api/cron/refresh-movies"] = {
      status: 200,
      body: '{"total":2,"refreshed":1,"failed":[550]}',
    };

    const { code, printed } = await smoke();

    expect(code).toBe(1);
    expect(printed).toContain('expected "failed":[], received "failed":[550]');
  });

  it("avec SMOKE_CRON=skip, la fumée passe sans appeler le cron ni connaître CRON_SECRET", async () => {
    const { code, printed } = await smoke(url, "invite", {
      SMOKE_READY_TIMEOUT: "0",
      SMOKE_CRON: "skip",
      CRON_SECRET: "",
    });

    expect(code).toBe(0);
    expect(requested).not.toContain("/api/cron/refresh-movies");
    expect(printed).toContain("(SMOKE_CRON=skip)");
    expect(printed).not.toContain("✕");
  });

  it("une valeur inconnue de SMOKE_CRON fait échouer la fumée avant toute requête", async () => {
    const { code, printed } = await smoke(url, "invite", {
      SMOKE_READY_TIMEOUT: "0",
      SMOKE_CRON: "yes",
    });

    expect(code).toBe(1);
    expect(printed).toContain(
      "✕ SMOKE_CRON: expected skip or empty, received yes",
    );
    expect(requested).toEqual([]);
  });
});
