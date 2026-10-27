import { mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabase } from "../src/db/create-database";
import { fakeTmdb } from "../tests/fake-tmdb/handler";
import { E2E_DATABASE, FAKE_TMDB_PORT } from "./env";

/**
 * Database up to date (never deleted: the app server may hold it open; each
 * test empties it, see fixtures), then the fake TMDB the app server calls.
 */
export default async function globalSetup() {
  mkdirSync("e2e/.data", { recursive: true });
  await migrate(createDatabase(`file:${E2E_DATABASE}`), {
    migrationsFolder: "drizzle",
  });

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
