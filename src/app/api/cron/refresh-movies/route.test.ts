import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const SECRET = "un-secret-de-cron-assez-long";
const refreshMovies = vi.fn();
const env = { CRON_SECRET: SECRET as string | undefined };

vi.mock("@/env", () => ({ getServerEnv: () => env }));
vi.mock("@/server/container", () => ({ getRefreshDeps: () => "deps" }));
vi.mock("@/features/refresh/refresh-movies", () => ({
  refreshMovies: (...args: unknown[]) => refreshMovies(...args),
}));

const call = (authorization?: string) =>
  GET(
    new Request("https://we-watch.test/api/cron/refresh-movies", {
      headers: authorization ? { authorization } : {},
    }),
  );

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  env.CRON_SECRET = SECRET;
  refreshMovies
    .mockReset()
    .mockResolvedValue({ total: 2, refreshed: 2, failed: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/cron/refresh-movies", () => {
  it("rafraîchit et renvoie le compte rendu", async () => {
    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      total: 2,
      refreshed: 2,
      failed: [],
    });
    expect(refreshMovies).toHaveBeenCalledWith("deps");
  });

  it("sans le bon secret : 401, rien n'est rafraîchi", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer faux")).status).toBe(401);
    env.CRON_SECRET = undefined;
    expect((await call("Bearer undefined")).status).toBe(401);
    expect(refreshMovies).not.toHaveBeenCalled();
  });

  it("journalise le compte rendu", async () => {
    await call(`Bearer ${SECRET}`);
    expect(console.info).toHaveBeenCalledWith("refresh-movies: done", {
      total: 2,
      refreshed: 2,
      failed: [],
    });
  });

  it("des échecs partiels : 200, mais un avertissement dans les logs", async () => {
    refreshMovies.mockResolvedValue({ total: 2, refreshed: 1, failed: [550] });

    expect((await call(`Bearer ${SECRET}`)).status).toBe(200);
    expect(console.warn).toHaveBeenCalledOnce();
  });

  it("tout en échec (TMDB en panne, jeton expiré) : 500 et une erreur", async () => {
    refreshMovies.mockResolvedValue({ total: 2, refreshed: 0, failed: [1, 2] });

    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ refreshed: 0 });
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("liste vide : rien à rafraîchir, ce n'est pas une panne", async () => {
    refreshMovies.mockResolvedValue({ total: 0, refreshed: 0, failed: [] });

    expect((await call(`Bearer ${SECRET}`)).status).toBe(200);
  });
});
