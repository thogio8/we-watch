import { CATALOG } from "./catalog";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

let down = false;

/** Simulates a TMDB outage: every request answers 503 until switched back. */
export function setTmdbDown(value: boolean): void {
  down = value;
}

/**
 * A tiny TMDB v3: movie details, discover (every deck gets the whole
 * catalogue on one page) and title search. Anything else is a 404.
 */
export function fakeTmdb(url: string | URL): Response {
  if (down) return json({ success: false }, 503);
  const { pathname, searchParams } = new URL(url);
  const movie = /\/movie\/(\d+)$/.exec(pathname);
  if (movie) {
    const found = CATALOG.find((m) => m.id === Number(movie[1]));
    return found ? json(found) : json({ success: false }, 404);
  }
  if (pathname.endsWith("/discover/movie")) {
    const ids = CATALOG.map(({ id }) => ({ id }));
    return json({ page: 1, results: ids, total_pages: 1 });
  }
  if (pathname.endsWith("/search/movie")) {
    const query = normalize(searchParams.get("query") ?? "");
    const results = CATALOG.filter((m) => normalize(m.title).includes(query));
    return json({ results: results.map(({ id }) => ({ id })) });
  }
  return json({ success: false }, 404);
}
