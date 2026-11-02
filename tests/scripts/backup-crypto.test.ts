import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptBackup, encryptBackup } from "../../scripts/backup-crypto.mjs";

// The release job encrypts the backup with BACKUP_KEY (a GitHub secret);
// restoring it (scripts/restore-db.mjs) decrypts it with the same key.

const KEY = randomBytes(32).toString("hex");
const OTHER_KEY = randomBytes(32).toString("hex");
const PLAIN = JSON.stringify({ user: [{ name: "Léa" }] });

type Envelope = ReturnType<typeof encryptBackup>;

/** Flips one bit of a base64 field of the envelope. */
function tampered(envelope: Envelope, field: "data" | "iv" | "tag") {
  const bytes = Buffer.from(envelope[field], "base64");
  bytes[0] = (bytes[0] ?? 0) ^ 1;
  return { ...envelope, [field]: bytes.toString("base64") };
}

describe("chiffrement de la sauvegarde", () => {
  it("aller-retour : le déchiffrement rend le texte chiffré", () => {
    const envelope = encryptBackup(PLAIN, KEY);

    expect(Object.keys(envelope)).toEqual(["v", "iv", "tag", "data"]);
    expect(envelope.v).toBe(1);
    expect(JSON.stringify(envelope)).not.toContain("Léa");
    expect(decryptBackup(envelope, KEY)).toBe(PLAIN);
  });

  it("la clé s'écrit aussi en majuscules", () => {
    const envelope = encryptBackup(PLAIN, KEY.toUpperCase());

    expect(decryptBackup(envelope, KEY)).toBe(PLAIN);
  });

  it("chaque chiffrement tire son propre vecteur d'initialisation", () => {
    const first = encryptBackup(PLAIN, KEY);
    const second = encryptBackup(PLAIN, KEY);

    expect(Buffer.from(first.iv, "base64")).toHaveLength(12);
    expect(second.iv).not.toBe(first.iv);
    expect(second.data).not.toBe(first.data);
  });

  it("une mauvaise clé ne déchiffre pas", () => {
    const envelope = encryptBackup(PLAIN, KEY);

    expect(() => decryptBackup(envelope, OTHER_KEY)).toThrow();
  });

  it.each(["data", "iv", "tag"] as const)(
    "un octet modifié (%s) est refusé",
    (field) => {
      const envelope = encryptBackup(PLAIN, KEY);

      expect(() => decryptBackup(tampered(envelope, field), KEY)).toThrow();
    },
  );

  it("une étiquette tronquée est refusée", () => {
    const envelope = encryptBackup(PLAIN, KEY);
    const short = Buffer.from(envelope.tag, "base64").subarray(0, 4);

    expect(() =>
      decryptBackup({ ...envelope, tag: short.toString("base64") }, KEY),
    ).toThrow();
  });

  it("une enveloppe d'une autre version est refusée", () => {
    const envelope = encryptBackup(PLAIN, KEY);

    expect(() => decryptBackup({ ...envelope, v: 2 }, KEY)).toThrow(
      "unknown backup format",
    );
  });

  it.each([
    ["absente", undefined],
    ["vide", ""],
    ["trop courte", KEY.slice(0, 62)],
    ["trop longue", `${KEY}00`],
    ["pas hexadécimale", `${KEY.slice(0, 63)}g`],
  ])("une clé %s est refusée, sans être affichée", (_, key) => {
    const run = () => encryptBackup(PLAIN, key as string);

    expect(run).toThrow(/^BACKUP_KEY (is missing|must be 64 hexadecimal)/);
    try {
      run();
    } catch (error) {
      if (key) expect(String(error)).not.toContain(key);
    }
  });
});
