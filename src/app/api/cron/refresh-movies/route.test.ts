import { beforeEach, describe, expect, it, vi } from "vitest";
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
  env.CRON_SECRET = SECRET;
  refreshMovies
    .mockReset()
    .mockResolvedValue({ total: 2, refreshed: 2, failed: [] });
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
});
