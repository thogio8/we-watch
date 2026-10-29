import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  TMDB_ACCESS_TOKEN: z.string().min(1, "TMDB_ACCESS_TOKEN is required"),
  // Only the end-to-end tests change it, to point at a local fake TMDB.
  TMDB_API_URL: z.url().default("https://api.themoviedb.org/3"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  // An empty value in .env files means "not set".
  DATABASE_AUTH_TOKEN: z
    .string()
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  // Shared code that unlocks a device (see src/access). The 500 ms delay on
  // a wrong code does not stop parallel guesses: length is the real defence.
  ACCESS_CODE: z.string().min(8, "ACCESS_CODE must be at least 8 characters"),
  // Signs Better Auth sessions and cookies (openssl rand -hex 32).
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  // Public address of the app: its host is the passkey rpID, its origin the
  // expected origin of every passkey ceremony.
  BETTER_AUTH_URL: z.url(),
  // "invite": signing up requires OWNER_CODE (invitations come later).
  SIGNUP: z.enum(["open", "invite"]).default("open"),
  // Owner's code to sign up when SIGNUP is "invite". Optional, empty = unset.
  OWNER_CODE: z
    .string()
    .optional()
    .transform((value) => (value === "" ? undefined : value))
    .refine(
      (value) => value === undefined || value.length >= 12,
      "OWNER_CODE must be at least 12 characters",
    ),
  // Bearer secret Vercel Cron sends to the daily refresh (src/access/cron).
  // Optional: without it, the refresh route stays closed.
  CRON_SECRET: z
    .string()
    .optional()
    .transform((value) => (value === "" ? undefined : value))
    .refine(
      (value) => value === undefined || value.length >= 16,
      "CRON_SECRET must be at least 16 characters",
    ),
});

type ServerEnv = z.output<typeof serverEnvSchema>;

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
  // Optional values are left out rather than set to undefined.
  const env: ServerEnv = Object.fromEntries(
    Object.entries(result.data).filter(([, value]) => value !== undefined),
  ) as ServerEnv;
  return env;
}

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
