// Reads any backup the CI ever kept, as { "<table>": [rows] }:
// - the 1.3.x `movies.json`: an array of `movies` rows;
// - the first 2.0 `db.json`: { "<table>": [rows] } in plaintext;
// - `db.json.enc` (scripts/backup-crypto.mjs): { v, iv, tag, data },
//   decrypted with BACKUP_KEY.
// Anything else is refused with « format de sauvegarde inconnu ». Messages
// never contain the key nor the backup's data.
import { readFileSync } from "node:fs";
import { decryptBackup, parseBackupKey } from "./backup-crypto.mjs";

const UNKNOWN = "format de sauvegarde inconnu";
const ENVELOPE_FIELDS = ["iv", "tag", "data"];
const BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

const isObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isRows = (value) => Array.isArray(value) && value.every(isObject);

function parse(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(UNKNOWN);
  }
}

/** { "<table>": [rows] }, or the refusal. */
function tables(value) {
  if (isRows(value)) return { movies: value };
  if (isObject(value) && Object.values(value).every(isRows)) return value;
  throw new Error(UNKNOWN);
}

// No table is named `v`: an object with `v` is an envelope, or nothing.
function decrypt(envelope, keyHex) {
  parseBackupKey(keyHex);
  const wellFormed =
    envelope.v === 1 &&
    ENVELOPE_FIELDS.every(
      (field) =>
        typeof envelope[field] === "string" && BASE64.test(envelope[field]),
    );
  if (!wellFormed) throw new Error(UNKNOWN);
  let plain;
  try {
    plain = decryptBackup(envelope, keyHex);
  } catch {
    throw new Error("sauvegarde illisible : mauvaise clé ou fichier modifié");
  }
  const decrypted = parse(plain);
  if (Array.isArray(decrypted)) throw new Error(UNKNOWN);
  return tables(decrypted);
}

/**
 * @param {string} path
 * @param {string | undefined} [keyHex] BACKUP_KEY, needed for an envelope only
 * @returns {Record<string, Record<string, unknown>[]>}
 */
export function readBackup(path, keyHex) {
  const content = parse(readFileSync(path, "utf8"));
  if (isObject(content) && "v" in content) return decrypt(content, keyHex);
  return tables(content);
}
