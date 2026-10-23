import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createTmdbClient, TmdbError } from "./client";

const schema = z.object({ ok: z.boolean() });

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("createTmdbClient", () => {
  it("envoie le token, language=fr-FR et les paramètres", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    const client = createTmdbClient({ accessToken: "tok", fetchImpl });
    await expect(client.get("/x", { a: 1, b: false }, schema)).resolves.toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit & { next?: unknown }];
    expect(url).toContain("https://api.themoviedb.org/3/x?");
    expect(url).toContain("language=fr-FR");
    expect(url).toContain("a=1");
    expect(url).toContain("b=false");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(init.cache).toBe("no-store");
  });

  it("passe le cache via next.revalidate", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    const client = createTmdbClient({ accessToken: "tok", fetchImpl });
    await client.get("/x", {}, schema, { revalidateSeconds: 60 });
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit & { next?: unknown }];
    expect(init.next).toEqual({ revalidate: 60 });
    expect(init.cache).toBeUndefined();
  });

  it("utilise le fetch global par défaut", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ ok: true }));
    await createTmdbClient({ accessToken: "tok" }).get("/x", {}, schema);
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it("401 → TmdbError status 401", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 401));
    const client = createTmdbClient({ accessToken: "bad", fetchImpl });
    await expect(client.get("/x", {}, schema)).rejects.toMatchObject({
      name: "TmdbError",
      status: 401,
    });
  });

  it("fetch rejeté → TmdbError status null", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));
    const client = createTmdbClient({ accessToken: "tok", fetchImpl });
    const err = await client.get("/x", {}, schema).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TmdbError);
    expect((err as TmdbError).status).toBeNull();
  });

  it("JSON invalide → TmdbError status null", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("not json", { status: 200 }));
    const client = createTmdbClient({ accessToken: "tok", fetchImpl });
    await expect(client.get("/x", {}, schema)).rejects.toMatchObject({ status: null });
  });

  it("JSON hors schéma → TmdbError status null", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: "nope" }));
    const client = createTmdbClient({ accessToken: "tok", fetchImpl });
    await expect(client.get("/x", {}, schema)).rejects.toMatchObject({ status: null });
  });
});
