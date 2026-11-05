import { randomBytes } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/db/create-database";
import { group } from "@/db/group-schema";
import { decryptBackup } from "../../scripts/backup-crypto.mjs";

// The CI's release job runs this script on production before migrating
// (.github/workflows/ci.yml): here, on throwaway database files.

const KEY = randomBytes(32).toString("hex");

let dir: string;
let url: string;
let out: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "we-watch-backup-"));
  url = `file:${join(dir, "app.db")}`;
  out = join(dir, "backup", "db.json.enc");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function run(key: string | undefined) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: url,
    DATABASE_AUTH_TOKEN: "",
  };
  delete env.BACKUP_KEY;
  if (key !== undefined) env.BACKUP_KEY = key;
  return env;
}

/** Runs the script; returns what it printed, the file and its decrypted JSON. */
function backup() {
  const printed = execFileSync("node", ["scripts/backup-db.mjs", out], {
    env: run(KEY),
    encoding: "utf8",
  });
  const written = readFileSync(out, "utf8");
  const plain = decryptBackup(JSON.parse(written), KEY);
  return {
    printed,
    written,
    plain,
    saved: JSON.parse(plain) as Record<string, Record<string, unknown>[]>,
  };
}

async function migrated() {
  await migrate(createDatabase(url), { migrationsFolder: "drizzle" });
}

/** Every table and column a secret could hide in, filled with SECRET-…. */
async function fillWithSecrets() {
  const client = createClient({ url });
  await client.batch([
    "insert into user (id, name, email) values ('u-1', 'Léa', 'u-1@wewatch.invalid')",
    `insert into passkey (id, name, public_key, user_id, credential_id, counter, device_type, backed_up, created_at)
       values ('pk-1', 'iPhone', 'PUBLIC-KEY', 'u-1', 'CRED-1', 0, 'multiDevice', 1, 1)`,
    `insert into account (id, account_id, provider_id, user_id, access_token, refresh_token, id_token,
       access_token_expires_at, refresh_token_expires_at, scope, password, updated_at)
       values ('a-1', 'u-1', 'google', 'u-1', 'SECRET-access', 'SECRET-refresh', 'SECRET-id', 1, 2, 'openid', 'SECRET-password', 3)`,
    `insert into session (id, expires_at, token, updated_at, ip_address, user_agent, user_id)
       values ('SECRET-session-id', 1, 'SECRET-session-token', 1, 'SECRET-ip', 'SECRET-agent', 'u-1')`,
    `insert into verification (id, identifier, value, expires_at)
       values ('SECRET-verification-id', 'SECRET-identifier', 'SECRET-value', 1)`,
    "insert into signup_ticket_use (jti, used_at) values ('SECRET-jti', 1)",
    "insert into rate_limit (key, count, window_start) values ('SECRET-key', 1, 1)",
    `insert into movie_snapshot (tmdb_id, title, overview, vote_average)
       values (244786, 'Whiplash', '', 8.4)`,
  ]);
  client.close();
}

describe("sauvegarde de la base avant migration", () => {
  it("une base neuve, sans table : un fichier vide, rien n'échoue", () => {
    const { printed, saved } = backup();

    expect(saved).toEqual({});
    expect(printed).toContain("movie_snapshot: absent");
    expect(printed).toContain("user: absent");
  });

  it("une base incomplète : seules les tables déjà là sont sauvées", async () => {
    const client = createClient({ url });
    await client.batch([
      "create table user (id text primary key, name text)",
      "insert into user values ('u-1', 'Léa')",
    ]);
    client.close();

    const { printed, saved } = backup();

    expect(saved).toEqual({ user: [{ id: "u-1", name: "Léa" }] });
    expect(printed).toContain("user: 1 rows");
    expect(printed).toContain("app_group: absent");
    expect(printed).toContain("account: absent");
  });

  it("une base migrée : chaque table de l'appli et les comptes, une entrée par table", async () => {
    await migrated();
    await createDatabase(url)
      .insert(group)
      .values({ id: "g-1", name: "NOUS DEUX" });

    const { printed, saved } = backup();

    expect(Object.keys(saved)).toEqual([
      "user",
      "passkey",
      "account",
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

  it("aucune session, vérification, ticket ni limite ; les comptes sans leurs jetons", async () => {
    await migrated();
    await fillWithSecrets();

    const { plain, saved } = backup();

    expect(plain).not.toContain("SECRET");
    for (const table of [
      "session",
      "verification",
      "signup_ticket_use",
      "rate_limit",
    ])
      expect(saved).not.toHaveProperty(table);
    expect(saved.account).toEqual([
      {
        id: "a-1",
        account_id: "u-1",
        provider_id: "google",
        user_id: "u-1",
        access_token_expires_at: 1,
        refresh_token_expires_at: 2,
        scope: "openid",
        created_at: expect.any(Number),
        updated_at: 3,
      },
    ]);
    expect(saved.user).toEqual([
      expect.objectContaining({ id: "u-1", name: "Léa" }),
    ]);
    expect(saved.passkey).toEqual([
      expect.objectContaining({ id: "pk-1", public_key: "PUBLIC-KEY" }),
    ]);
  });

  it("le fichier écrit ne contient en clair ni un prénom ni un titre", async () => {
    await migrated();
    await fillWithSecrets();

    const { printed, written, plain } = backup();

    expect(plain).toContain("Léa");
    expect(plain).toContain("Whiplash");
    for (const text of [written, printed]) {
      expect(text).not.toContain("Léa");
      expect(text).not.toContain("Whiplash");
    }
    expect(Object.keys(JSON.parse(written))).toEqual([
      "v",
      "iv",
      "tag",
      "data",
    ]);
  });

  it.each([
    ["absente", undefined, "BACKUP_KEY is missing"],
    ["vide", "", "BACKUP_KEY is missing"],
    ["de mauvaise taille", KEY.slice(0, 32), "BACKUP_KEY must be 64"],
    ["pas hexadécimale", "z".repeat(64), "BACKUP_KEY must be 64"],
  ])(
    "une clé %s : échec, aucun fichier, la clé n'est pas affichée",
    async (_, key, message) => {
      await migrated();

      const result = spawnSync("node", ["scripts/backup-db.mjs", out], {
        env: run(key),
        encoding: "utf8",
      });

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(message);
      if (key) expect(result.stderr + result.stdout).not.toContain(key);
      expect(existsSync(out)).toBe(false);
    },
  );
});
