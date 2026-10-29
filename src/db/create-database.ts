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

export function createDatabase(url: string, authToken?: string): Database {
  const client = createClient(
    authToken === undefined ? { url } : { url, authToken },
  );
  return drizzle(client, { schema });
}
