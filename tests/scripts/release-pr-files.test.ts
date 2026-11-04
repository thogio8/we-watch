import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SCRIPT = "scripts/release-pr-files.mjs";

function check(stdin: string) {
  const run = spawnSync("node", [SCRIPT], { input: stdin, encoding: "utf8" });
  return { code: run.status, out: run.stdout + run.stderr };
}

describe("la vérification des fichiers d'une PR de version", () => {
  it("une PR qui ne touche que les fichiers de version passe", () => {
    const files = "CHANGELOG.md\nversion.txt\n.release-please-manifest.json\n";
    expect(check(files).code).toBe(0);
    expect(check("version.txt\n").code).toBe(0);
  });

  it("un autre fichier fait échouer et il est nommé", () => {
    const run = check(
      "CHANGELOG.md\nsrc/domain/draw.ts\n.github/workflows/ci.yml\n",
    );
    expect(run.code).toBe(1);
    expect(run.out).toContain("src/domain/draw.ts");
    expect(run.out).toContain(".github/workflows/ci.yml");
    expect(run.out).not.toContain("CHANGELOG.md");
  });

  it("une liste vide échoue", () => {
    expect(check("").code).toBe(1);
    expect(check("\n\n").code).toBe(1);
  });

  it("la liste suit paths-ignore de ci.yml", () => {
    const ci = readFileSync(".github/workflows/ci.yml", "utf8");
    const block = ci.match(/paths-ignore:\n((?:\s+- .+\n)+)/)?.[1] ?? "";
    const ignored = [...block.matchAll(/- (.+)/g)].map((m) => m[1]);
    expect(ignored.length).toBeGreaterThan(0);
    expect(check(ignored.join("\n")).code).toBe(0);
    const list =
      readFileSync(SCRIPT, "utf8").match(/VERSION_FILES = \[([^\]]*)\]/)?.[1] ??
      "";
    const versionFiles = [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect([...versionFiles].sort()).toEqual([...ignored].sort());
  });
});
