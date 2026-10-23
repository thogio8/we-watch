import { z } from "zod";

// Only the fields we actually use are required; zod objects strip unknown keys.

export const tmdbDiscoverSchema = z.object({
  page: z.number(),
  results: z.array(z.object({ id: z.number() })),
  total_pages: z.number(),
});

export const tmdbSearchSchema = z.object({
  results: z.array(z.object({ id: z.number() })),
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
