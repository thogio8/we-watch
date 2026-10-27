import type { TmdbMovieDetails } from "@/tmdb/schemas";

type Provider = "Netflix" | "Netflix Standard with Ads" | "Prime" | "Canal+";

const PROVIDERS: Record<Provider, [id: number, name: string]> = {
  Netflix: [8, "Netflix"],
  "Netflix Standard with Ads": [1796, "Netflix Standard with Ads"],
  Prime: [119, "Amazon Prime Video"],
  "Canal+": [381, "Canal+"],
};

interface Entry {
  id: number;
  title: string;
  date: string;
  runtime: number;
  genres: number[];
  providers: Provider[];
  trailer?: string;
}

/** Answers TMDB would give for a movie, trimmed to what we read. */
function details(entry: Entry): TmdbMovieDetails {
  return {
    id: entry.id,
    title: entry.title,
    release_date: entry.date,
    runtime: entry.runtime,
    overview: `Résumé de ${entry.title}.`,
    poster_path: null,
    vote_average: 8.2,
    genres: entry.genres.map((id) => ({ id })),
    videos: {
      results: entry.trailer
        ? [{ key: entry.trailer, site: "YouTube", type: "Trailer" }]
        : [],
    },
    "watch/providers": {
      results: {
        FR: {
          flatrate: entry.providers.map((name, index) => {
            const [provider_id, provider_name] = PROVIDERS[name];
            return {
              provider_id,
              provider_name,
              logo_path: null,
              display_priority: index,
            };
          }),
        },
      },
    },
  };
}

/**
 * The fake catalogue, in « mieux notés » order. Runtimes and genres cover the
 * « ce soir » filters: short / long, rire (35), frissonner (53), animation.
 */
const ENTRIES: Entry[] = [
  {
    id: 244786,
    title: "Whiplash",
    date: "2014-10-08",
    runtime: 107,
    genres: [18, 10402],
    providers: ["Netflix", "Netflix Standard with Ads"],
    trailer: "7d_jQycdQGo",
  },
  {
    id: 129,
    title: "Le Voyage de Chihiro",
    date: "2001-07-20",
    runtime: 125,
    genres: [16, 14, 10751],
    providers: ["Netflix"],
  },
  {
    id: 496243,
    title: "Parasite",
    date: "2019-05-30",
    runtime: 132,
    genres: [35, 53, 18],
    providers: ["Prime"],
  },
  {
    id: 194,
    title: "Le Fabuleux Destin d'Amélie Poulain",
    date: "2001-04-25",
    runtime: 122,
    genres: [35, 10749],
    providers: ["Canal+"],
  },
  {
    id: 27205,
    title: "Inception",
    date: "2010-07-15",
    runtime: 148,
    genres: [28, 878],
    providers: [],
  },
];

export const CATALOG: readonly TmdbMovieDetails[] = ENTRIES.map(details);
