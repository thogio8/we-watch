import { z } from "zod";

// Only the fields we actually use are required; zod objects strip unknown keys.

export const tmdbDiscoverSchema = z.object({
  page: z.number(),
  results: z.array(z.object({ id: z.number() })),
  total_pages: z.number(),
});

export const tmdbSearchSchema = z.object({
  results: z.array(
    z.object({ id: z.number(), vote_count: z.number().default(0) }),
  ),
  total_pages: z.number().default(1),
});

const tmdbProviderSchema = z.object({
  provider_id: z.number(),
  provider_name: z.string(),
  logo_path: z.string().nullable(),
  display_priority: z.number(),
});

export const tmdbMovieDetailsSchema = z.object({
  id: z.number(),
  title: z.string(),
  release_date: z.string().nullish(),
  runtime: z.number().nullish(),
  overview: z.string().nullish(),
  poster_path: z.string().nullable().optional(),
  vote_average: z.number(),
  genres: z.array(z.object({ id: z.number() })).optional(),
  videos: z
    .object({
      results: z.array(
        z.object({
          key: z.string(),
          site: z.string(),
          type: z.string(),
          official: z.boolean().optional(),
          iso_639_1: z.string().nullish(),
        }),
      ),
    })
    .optional(),
  "watch/providers": z
    .object({
      results: z.record(
        z.string(),
        z.object({ flatrate: z.array(tmdbProviderSchema).optional() }),
      ),
    })
    .optional(),
});

export type TmdbMovieDetails = z.infer<typeof tmdbMovieDetailsSchema>;

export const tmdbCreditsSchema = z.object({
  cast: z.array(z.object({ name: z.string(), order: z.number() })),
  crew: z.array(z.object({ name: z.string(), job: z.string() })),
});

export type TmdbCredits = z.infer<typeof tmdbCreditsSchema>;
