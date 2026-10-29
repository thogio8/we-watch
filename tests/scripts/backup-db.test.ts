import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/db/create-database";
import { group } from "@/db/group-schema";

// The CI's release job runs this script on production before migrating
// (.github/workflows/ci.yml): here, on throwaway database files.

let dir: string;
let url: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "we-watch-backup-"));
  url = `file:${join(dir, "app.db")}`;
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** Runs the script; returns what it printed and the JSON it wrote. */
function backup() {
  const out = join(dir, "backup", "db.json");
  const printed = execFileSync("node", ["scripts/backup-db.mjs", out], {
    env: { ...process.env, DATABASE_URL: url, DATABASE_AUTH_TOKEN: "" },
    encoding: "utf8",
  });
  return {
    printed,
    saved: JSON.parse(readFileSync(out, "utf8")) as Record<string, unknown[]>,
  };
}

describe("sauvegarde de la base avant migration", () => {
  it("une base neuve, sans table : un fichier vide, rien n'échoue", () => {
    const { printed, saved } = backup();

    expect(saved).toEqual({});
    expect(printed).toContain("movies: absent");
  });

  it("une base 1.3.x : seule la table movies, déjà là, est sauvée", async () => {
    const client = createClient({ url });
    await client.batch([
      "create table movies (tmdb_id integer primary key, title text)",
      "insert into movies values (244786, 'Whiplash')",
    ]);
    client.close();

    const { printed, saved } = backup();

    expect(saved).toEqual({ movies: [{ tmdb_id: 244786, title: "Whiplash" }] });
    expect(printed).toContain("movies: 1 rows");
    expect(printed).toContain("app_group: absent");
  });

  it("une base migrée : chaque table de l'appli, une entrée par table", async () => {
    const db = createDatabase(url);
    await migrate(db, { migrationsFolder: "drizzle" });
    await db.insert(group).values({ id: "g-1", name: "NOUS DEUX" });

    const { printed, saved } = backup();

    expect(Object.keys(saved)).toEqual([
      "movies",
      "movie_snapshot",
      "app_group",
      "membership",
      "group_movie",
      "movie_want",
      "movie_rejection",
    ]);
    expect(saved.app_group).toEqual([
      expect.objectContaining({ id: "g-1", name: "NOUS DEUX" }),
    ]);
    expect(printed).toContain("app_group: 1 rows");
    expect(printed).not.toContain("NOUS DEUX");
  });
});
