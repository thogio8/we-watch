import { execFile } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// The CI's release job promotes the new deployment, then smoke tests
// production (.github/workflows/ci.yml). Vercel may switch production after
// answering the promote (202): the script waits until the project says the
// promoted deployment serves production. Here, against a fake Vercel API.

const TOKEN = "fake-vercel-token-never-printed";
const OLD = "dpl_old";
const NEW = "dpl_new";

type AliasJob = { toDeploymentId: string; jobStatus: string } | null;
/** The project as each poll sees it, the last one repeating; "blip": a 502. */
let states: ({ production: string; job: AliasJob } | "blip")[];
let promoteStatus: number;
let promoteBody: unknown;
let polls: number;
/** The deployment lookup never answers (a stalled Vercel API). */
let lookupHangs: boolean;
let server: Server;
let api: string;

beforeEach(async () => {
  promoteStatus = 202;
  promoteBody = {};
  polls = 0;
  lookupHangs = false;
  states = [
    { production: NEW, job: { toDeploymentId: NEW, jobStatus: "succeeded" } },
  ];
  server = createServer((request, response) => {
    if (request.headers.authorization !== `Bearer ${TOKEN}`) {
      return void response.writeHead(401).end();
    }
    const path = request.url?.split("?")[0] ?? "";
    const send = (status: number, body: unknown) =>
      response.writeHead(status).end(JSON.stringify(body));
    if (path.startsWith("/v13/deployments/")) {
      return lookupHangs ? undefined : send(200, { id: NEW });
    }
    if (path === `/v10/projects/prj_1/promote/${NEW}`) {
      return send(promoteStatus, promoteBody);
    }
    if (path === "/v9/projects/prj_1") {
      const state = states[Math.min(polls++, states.length - 1)]!;
      if (state === "blip") {
        return void response.writeHead(502).end("<html>Bad Gateway</html>");
      }
      const { production, job } = state;
      return send(200, {
        targets: { production: { id: production } },
        lastAliasRequest: job,
      });
    }
    send(404, {});
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  api = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(() => {
  server.closeAllConnections();
  return new Promise((resolve) => server.close(resolve));
});

async function run(...args: string[]) {
  const env = {
    ...process.env,
    VERCEL_API_URL: api,
    VERCEL_TOKEN: TOKEN,
    VERCEL_ORG_ID: "team_1",
    VERCEL_PROJECT_ID: "prj_1",
    VERCEL_PROMOTE_TIMEOUT: "2",
    VERCEL_POLL_INTERVAL: "0.05",
    VERCEL_MAX_TIME: "1",
  };
  try {
    const { stdout } = await promisify(execFile)(
      "bash",
      ["scripts/vercel-prod.sh", ...args],
      { env },
    );
    return { code: 0, printed: stdout };
  } catch (error) {
    const { code, stdout, stderr } = error as Record<string, string>;
    return { code: Number(code), printed: `${stdout}${stderr}` };
  }
}

const promote = () => run("promote", "https://we-watch-abc.vercel.app");

const pending = {
  production: OLD,
  job: { toDeploymentId: NEW, jobStatus: "in-progress" },
};

describe("mise en ligne d'un déploiement (vercel-prod.sh promote)", () => {
  it("la prod bascule aussitôt : vert dès la première lecture", async () => {
    const { code, printed } = await promote();

    expect(code).toBe(0);
    expect(printed).toContain(`✓ ${NEW} in production`);
    expect(polls).toBe(1);
    expect(printed).not.toContain(TOKEN);
  });

  it("la prod bascule après quelques lectures : attend, puis vert", async () => {
    states = [pending, pending, { ...pending, production: NEW }, states[0]!];

    const { code, printed } = await promote();

    expect(code).toBe(0);
    expect(printed).toContain(`✓ ${NEW} in production`);
    expect(polls).toBe(4);
  });

  it("la prod ne bascule jamais : rouge à l'échéance, attendu et reçu affichés", async () => {
    states = [pending];

    const { code, printed } = await promote();

    expect(code).toBe(1);
    expect(printed).toContain(
      `✕ production after 2 s: expected ${NEW} (alias job succeeded), received ${OLD} (alias job in-progress)`,
    );
    expect(printed).not.toContain(TOKEN);
  });

  it("la bascule échoue chez Vercel : rouge sans attendre l'échéance", async () => {
    states = [
      { production: OLD, job: { toDeploymentId: NEW, jobStatus: "failed" } },
    ];

    const { code, printed } = await promote();

    expect(code).toBe(1);
    expect(printed).toContain("received dpl_old (alias job failed)");
    expect(polls).toBe(1);
  });

  it("une bascule « skipped » (terminale pour Vercel) : vert", async () => {
    states = [
      { production: NEW, job: { toDeploymentId: NEW, jobStatus: "skipped" } },
    ];

    const { code, printed } = await promote();

    expect(code).toBe(0);
    expect(printed).toContain(`✓ ${NEW} in production`);
  });

  it("une réponse en panne de l'API (502, pas du JSON) puis la bascule : vert", async () => {
    states = ["blip", pending, states[0]!];

    const { code, printed } = await promote();

    expect(code).toBe(0);
    expect(printed).toContain(`✓ ${NEW} in production`);
    expect(polls).toBe(3);
  });

  it("l'API en panne jusqu'à l'échéance : rouge, attendu et reçu, sans trace Node", async () => {
    states = ["blip"];

    const { code, printed } = await promote();

    expect(code).toBe(1);
    expect(printed).toContain(
      `✕ production after 2 s: expected ${NEW} (alias job succeeded), received unreachable (alias job none)`,
    );
    expect(polls).toBeGreaterThan(1);
    expect(printed).not.toMatch(/SyntaxError|at JSON\.parse|node:/);
    expect(printed).not.toContain(TOKEN);
  });

  it("déjà en prod (Vercel refuse la promotion) : vert si le projet le confirme", async () => {
    promoteStatus = 409;
    promoteBody = {
      error: { message: "This is already the current production deployment" },
    };
    states = [
      { production: NEW, job: { toDeploymentId: OLD, jobStatus: "succeeded" } },
    ];

    const { code, printed } = await promote();

    expect(code).toBe(0);
    expect(printed).toContain(`✓ ${NEW} in production`);
  });

  it("une promotion refusée : rouge, sans attendre", async () => {
    promoteStatus = 403;

    const { code, printed } = await promote();

    expect(code).toBe(1);
    expect(printed).toContain(`✕ promote ${NEW} answered 403`);
    expect(polls).toBe(0);
    expect(printed).not.toContain(TOKEN);
  });
});

describe("le déploiement en prod avant la mise en ligne (vercel-prod.sh current)", () => {
  it("affiche l'id du déploiement en prod", async () => {
    const { code, printed } = await run("current");

    expect(code).toBe(0);
    expect(printed.trim()).toBe(NEW);
  });

  it("l'API répond une erreur : rouge, sans corps ni jeton (le retour arrière en dépend)", async () => {
    states = ["blip"];

    const { code, printed } = await run("current");

    expect(code).toBe(1);
    expect(printed).toContain("✕ current production");
    expect(printed).not.toContain("Bad Gateway");
    expect(printed).not.toContain(TOKEN);
  });

  it("le projet ne dit aucun déploiement en prod : rouge, jamais un id vide", async () => {
    states = [{ production: "", job: null }];

    const { code, printed } = await run("current");

    expect(code).toBe(1);
    expect(printed).toContain("✕ current production");
  });
});

describe("une API Vercel bloquée (vercel-prod.sh promote)", () => {
  it("la recherche du déploiement ne répond pas : rouge à l'échéance de la requête", async () => {
    lookupHangs = true;

    const { code, printed } = await promote();

    expect(code).toBe(1);
    expect(printed).toContain("✕ deployment we-watch-abc.vercel.app");
    expect(polls).toBe(0);
    expect(printed).not.toContain(TOKEN);
  });
});
