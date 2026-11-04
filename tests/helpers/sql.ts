import { createClient } from "@libsql/client";

/** Runs statements in one write batch on a database file URL. */
export async function sql(url: string, statements: string[]) {
  const client = createClient({ url });
  await client.batch(statements, "write");
  client.close();
}
