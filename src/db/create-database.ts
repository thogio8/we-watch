import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as authSchema from "./auth-schema";
import * as appSchema from "./schema";

const schema = { ...appSchema, ...authSchema };

export type Database = LibSQLDatabase<typeof schema>;

export function createDatabase(url: string, authToken?: string): Database {
  const client = createClient(
    authToken === undefined ? { url } : { url, authToken },
  );
  return drizzle(client, { schema });
}
