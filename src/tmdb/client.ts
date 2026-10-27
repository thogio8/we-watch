import "server-only";
import type { z } from "zod";

export class TmdbError extends Error {
  constructor(
    readonly status: number | null,
    message: string,
  ) {
    super(message);
    this.name = "TmdbError";
  }
}

export interface TmdbClient {
  /**
   * GET a TMDB v3 endpoint and validate the JSON body with `schema`.
   * Without `cache`, the request is never cached (`cache: "no-store"`);
   * with it, Next's data cache revalidates every `revalidateSeconds`.
   */
  get<T>(
    path: string,
    params: Record<string, string | number | boolean>,
    schema: z.ZodType<T>,
    cache?: { revalidateSeconds: number },
  ): Promise<T>;
}

export function createTmdbClient(opts: {
  accessToken: string;
  baseUrl: string;
  fetchImpl?: typeof fetch;
}): TmdbClient {
  const fetchImpl = opts.fetchImpl ?? fetch;

  return {
    async get(path, params, schema, cache) {
      const query = new URLSearchParams({ language: "fr-FR" });
      for (const [key, value] of Object.entries(params)) {
        query.set(key, String(value));
      }
      const init: RequestInit & { next?: { revalidate: number } } = {
        headers: {
          Authorization: `Bearer ${opts.accessToken}`,
          Accept: "application/json",
        },
        ...(cache
          ? { next: { revalidate: cache.revalidateSeconds } }
          : { cache: "no-store" as const }),
      };

      let response: Response;
      try {
        response = await fetchImpl(`${opts.baseUrl}${path}?${query}`, init);
      } catch {
        throw new TmdbError(null, "TMDB request failed");
      }
      if (!response.ok) {
        throw new TmdbError(
          response.status,
          `TMDB responded ${response.status}`,
        );
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new TmdbError(null, "TMDB returned invalid JSON");
      }
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        throw new TmdbError(
          null,
          "TMDB response does not match the expected schema",
        );
      }
      return parsed.data;
    },
  };
}
