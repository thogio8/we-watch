// Pure TMDB image URL builder, shared by server code and client components (no `server-only`).
export type PosterSize = "w92" | "w342" | "w500";

export function posterUrl(path: string, size: PosterSize): string {
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
