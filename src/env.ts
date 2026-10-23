import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  TMDB_ACCESS_TOKEN: z.string().min(1, "TMDB_ACCESS_TOKEN is required"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  // An empty value in .env files means "not set".
  DATABASE_AUTH_TOKEN: z
    .string()
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
});

export type ServerEnv = {
  TMDB_ACCESS_TOKEN: string;
  DATABASE_URL: string;
  DATABASE_AUTH_TOKEN?: string;
};

export function parseServerEnv(
  source: Record<string, string | undefined>,
): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid server environment: ${details}`);
  }
  const { DATABASE_AUTH_TOKEN, ...rest } = result.data;
  return DATABASE_AUTH_TOKEN === undefined
    ? rest
    : { ...rest, DATABASE_AUTH_TOKEN };
}

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
