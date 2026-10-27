import type { TmdbCredits, TmdbMovieDetails } from "@/tmdb/schemas";

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
  director: string;
  cast: string[];
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
    director: "Damien Chazelle",
    cast: ["Miles Teller", "J.K. Simmons"],
    date: "2014-10-08",
    runtime: 107,
    genres: [18, 10402],
    providers: ["Netflix", "Netflix Standard with Ads"],
    trailer: "7d_jQycdQGo",
  },
  {
    id: 129,
    title: "Le Voyage de Chihiro",
    director: "Hayao Miyazaki",
    cast: ["Rumi Hiiragi", "Miyu Irino"],
    date: "2001-07-20",
    runtime: 125,
    genres: [16, 14, 10751],
    providers: ["Netflix"],
  },
  {
    id: 496243,
    title: "Parasite",
    director: "Bong Joon-ho",
    cast: [
      "Song Kang-ho",
      "Lee Sun-kyun",
      "Cho Yeo-jeong",
      "Choi Woo-shik",
      "Park So-dam",
    ],
    date: "2019-05-30",
    runtime: 132,
    genres: [35, 53, 18],
    providers: ["Prime"],
  },
  {
    id: 194,
    title: "Le Fabuleux Destin d'Amélie Poulain",
    director: "Jean-Pierre Jeunet",
    cast: ["Audrey Tautou", "Mathieu Kassovitz"],
    date: "2001-04-25",
    runtime: 122,
    genres: [35, 10749],
    providers: ["Canal+"],
  },
  {
    id: 27205,
    title: "Inception",
    director: "Christopher Nolan",
    cast: ["Leonardo DiCaprio", "Joseph Gordon-Levitt"],
    date: "2010-07-15",
    runtime: 148,
    genres: [28, 878],
    providers: [],
  },
];

export const CATALOG: readonly TmdbMovieDetails[] = ENTRIES.map(details);

/** TMDB /movie/<id>/credits of a catalogue movie, null if unknown. */
export function creditsOf(tmdbId: number): TmdbCredits | null {
  const entry = ENTRIES.find((e) => e.id === tmdbId);
  if (!entry) return null;
  return {
    cast: entry.cast.map((name, order) => ({ name, order })),
    crew: [
      { name: entry.director, job: "Director" },
      { name: "Une scripte", job: "Script Supervisor" },
    ],
  };
}
