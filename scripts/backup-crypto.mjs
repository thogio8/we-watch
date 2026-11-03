// Encrypts and decrypts a database backup (AES-256-GCM, Node's crypto).
// The key is BACKUP_KEY: 64 hexadecimal characters (32 random bytes, e.g.
// `openssl rand -hex 32`), a GitHub secret with an offline copy kept by the
// maintainer. A changed key no longer decrypts older backups.
// Envelope (JSON): { v: 1, iv, tag, data }, base64; a random 12-byte IV per
// file, the 16-byte authentication tag stored alongside. A wrong key or any
// altered byte makes decryption throw. Messages never contain the key.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** The 32-byte key, or an error that names the variable, never its value. */
export function parseBackupKey(keyHex) {
  if (!keyHex) {
    throw new Error(
      "BACKUP_KEY is missing: refusing to write or read a backup without it",
    );
  }
  if (!/^[0-9a-f]{64}$/i.test(keyHex)) {
    throw new Error(
      "BACKUP_KEY must be 64 hexadecimal characters (32 bytes: openssl rand -hex 32)",
    );
  }
  return Buffer.from(keyHex, "hex");
}

/**
 * @param {string} plain the backup, as JSON text
 * @param {string | undefined} keyHex
 * @returns {{ v: 1, iv: string, tag: string, data: string }}
 */
export function encryptBackup(plain, keyHex) {
  const key = parseBackupKey(keyHex);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_BYTES,
  });
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return {
    v: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  };
}

/**
 * @param {{ v: unknown, iv: string, tag: string, data: string }} envelope
 * @param {string | undefined} keyHex
 * @returns {string} the backup, as JSON text
 */
export function decryptBackup(envelope, keyHex) {
  const key = parseBackupKey(keyHex);
  if (envelope?.v !== 1) throw new Error("unknown backup format");
  const tag = Buffer.from(envelope.tag, "base64");
  // Node accepts shorter GCM tags unless told otherwise: insist on 16 bytes.
  if (tag.length !== TAG_BYTES) throw new Error("invalid backup tag");
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(envelope.iv, "base64"),
    { authTagLength: TAG_BYTES },
  );
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.data, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
