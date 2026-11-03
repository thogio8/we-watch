import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

// Raw bidi controls and zero-width characters hide in source (Trojan Source):
// they must be written as \u escapes, which are plain ASCII.
const INVISIBLE =
  /[\u200B\u200C\u200E\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/u;
const EXTENSIONS = new Set([".ts", ".tsx", ".css", ".mjs"]);

function sourcesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourcesUnder(path);
    return EXTENSIONS.has(extname(path)) ? [path] : [];
  });
}

describe("source hygiene", () => {
  it("n'a aucun caractère invisible brut dans src, tests et e2e", () => {
    const offenders = ["src", "tests", "e2e"]
      .flatMap(sourcesUnder)
      .filter((path) => INVISIBLE.test(readFileSync(path, "utf8")));
    expect(offenders).toEqual([]);
  });
});
