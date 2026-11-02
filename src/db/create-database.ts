import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as authSchema from "./auth-schema";
import * as groupSchema from "./group-schema";
import * as appSchema from "./schema";

const schema = { ...appSchema, ...authSchema, ...groupSchema };

export type Database = LibSQLDatabase<typeof schema>;

/** The database, or a transaction on it: what shared write helpers take. */
export type Executor =
  Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * A local file (dev, tests, e2e) is shared with other processes (e2e
 * fixtures, scripts): wait for their lock rather than fail at once with
 * SQLITE_BUSY. Remote databases (Turso) ignore it.
 */
const BUSY_TIMEOUT_MS = 5000;

export function createDatabase(url: string, authToken?: string): Database {
  const client = createClient({
    url,
    timeout: BUSY_TIMEOUT_MS,
    ...(authToken === undefined ? {} : { authToken }),
  });
  return drizzle(client, { schema });
}
