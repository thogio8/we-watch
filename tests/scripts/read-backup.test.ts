import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { encryptBackup } from "../../scripts/backup-crypto.mjs";
import { readBackup } from "../../scripts/read-backup.mjs";

// Restoring (scripts/restore-db.mjs) and the 2.0 rehearsal read every backup
// the CI ever kept: the 1.3.x `movies.json` (an array of movies), the first
// 2.0 `db.json` (one plaintext entry per table) and `db.json.enc` (5a).

const KEY = randomBytes(32).toString("hex");
const TABLES = {
  user: [{ id: "u-1", name: "Léa" }],
  movies: [{ tmdb_id: 244786, title: "Whiplash" }],
};
const UNKNOWN = "format de sauvegarde inconnu";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "we-watch-read-backup-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function file(content: unknown) {
  const path = join(dir, "backup.json");
  writeFileSync(
    path,
    typeof content === "string" ? content : JSON.stringify(content),
  );
  return path;
}

const envelope = () => encryptBackup(JSON.stringify(TABLES), KEY);

describe("lecture d'une sauvegarde", () => {
  it("le tableau de films de la 1.3.x (movies.json) devient la table movies", () => {
    expect(readBackup(file(TABLES.movies))).toEqual({ movies: TABLES.movies });
  });

  it("l'objet par table en clair est rendu tel quel, sans clé", () => {
    expect(readBackup(file(TABLES))).toEqual(TABLES);
  });

  it("l'enveloppe chiffrée est déchiffrée avec la clé", () => {
    expect(readBackup(file(envelope()), KEY)).toEqual(TABLES);
  });

  it("une enveloppe sans clé : refusée, en nommant BACKUP_KEY", () => {
    expect(() => readBackup(file(envelope()))).toThrow("BACKUP_KEY is missing");
  });

  it("une enveloppe avec une autre clé : refusée, sans afficher la clé", () => {
    const other = randomBytes(32).toString("hex");
    let message = "";
    try {
      readBackup(file(envelope()), other);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toBe(
      "sauvegarde illisible : mauvaise clé ou fichier modifié",
    );
    expect(message).not.toContain(other);
  });

  it.each([
    ["sans iv", { iv: undefined }],
    ["sans tag", { tag: undefined }],
    ["sans data", { data: undefined }],
    ["un iv qui n'est pas du base64", { iv: "pas du base64 !" }],
    ["un tag qui n'est pas un texte", { tag: 42 }],
    ["une autre version", { v: 2 }],
  ])("une enveloppe %s : « %s »", (_, change) => {
    const path = file({ ...envelope(), ...change });

    expect(() => readBackup(path, KEY)).toThrow(UNKNOWN);
  });

  it.each([
    ["un texte qui n'est pas du JSON", "pas du json"],
    ["un nombre", 42],
    ["null", null],
    ["un tableau qui ne contient pas des lignes", [1, 2]],
    ["une table qui n'est pas un tableau", { movies: { tmdb_id: 1 } }],
    ["une ligne qui n'est pas un objet", { movies: ["Whiplash"] }],
  ])("%s : « format de sauvegarde inconnu »", (_, content) => {
    expect(() => readBackup(file(content), KEY)).toThrow(UNKNOWN);
  });

  it("une enveloppe dont le contenu déchiffré n'est pas un objet par table : refusée", () => {
    const path = file(encryptBackup(JSON.stringify([1]), KEY));

    expect(() => readBackup(path, KEY)).toThrow(UNKNOWN);
  });
});
