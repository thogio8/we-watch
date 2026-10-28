import { mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabase } from "../src/db/create-database";
import { fakeTmdb } from "../tests/fake-tmdb/handler";
import { databaseOf, FAKE_TMDB_PORT, workerIndexes } from "./env";

/**
 * Worker databases up to date (never deleted: an app server may hold one
 * open; each test empties its own, see fixtures), then the fake TMDB the app
 * servers call.
 */
export default async function globalSetup() {
  mkdirSync("e2e/.data", { recursive: true });
  for (const worker of workerIndexes()) {
    await migrate(createDatabase(`file:${databaseOf(worker)}`), {
      migrationsFolder: "drizzle",
    });
  }

  const server = createServer(async (request, response) => {
    const answer = fakeTmdb(`http://localhost${request.url}`);
    response.writeHead(answer.status, {
      "content-type": "application/json",
    });
    response.end(await answer.text());
  });
  await new Promise<void>((resolve) => server.listen(FAKE_TMDB_PORT, resolve));
  return () => new Promise<void>((resolve) => server.close(() => resolve()));
}
