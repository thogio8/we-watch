import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The workflows are read as text (no YAML dependency). Rules for every file
// of .github/workflows, then the shape of the nightly one.

const DIR = ".github/workflows";
const workflows = readdirSync(DIR)
  .filter((file) => /\.ya?ml$/.test(file))
  .map((file) => ({ file, text: readFileSync(`${DIR}/${file}`, "utf8") }));

/** Step-level `env:` values sit at 10 spaces (`jobs:` > job > steps > `-`). */
const STEP_ENV_INDENT = 10;

const unpinned = (text: string) =>
  text
    .split("\n")
    .filter((line) => /^\s*(-\s+)?uses:/.test(line))
    .filter((line) => !/uses:\s*(\.\/|docker:\/\/)/.test(line))
    .filter((line) => !/@[0-9a-f]{40} # v\d/.test(line));

/** Lines using a secret anywhere but a step's own `env:`. */
const misplacedSecrets = (text: string) =>
  text
    .split("\n")
    .filter((line) => line.includes("secrets."))
    .filter((line) => line.search(/\S/) < STEP_ENV_INDENT);

/** Checkout steps that leave the token in .git/config for the next steps. */
function keptCredentials(text: string) {
  const lines = text.split("\n");
  return lines.flatMap((line, i) => {
    if (!/uses:\s*actions\/checkout@/.test(line)) return [];
    const dash = line.indexOf("-");
    const end = lines.findIndex(
      (next, j) => j > i && next.trim() !== "" && next.search(/\S/) <= dash,
    );
    const step = lines.slice(i, end === -1 ? undefined : end).join("\n");
    return /persist-credentials: false/.test(step) ? [] : [line.trim()];
  });
}

function job(text: string, name: string) {
  const start = text.indexOf(`\n  ${name}:\n`);
  expect(start, `job ${name}`).toBeGreaterThan(-1);
  const rest = text.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}[\w-]+:\n/);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

describe("les workflows GitHub (.github/workflows)", () => {
  it("chaque action du dépôt est épinglée par un SHA", () => {
    expect(workflows.length).toBeGreaterThan(0);
    for (const { file, text } of workflows) {
      expect(unpinned(text), file).toEqual([]);
    }
  });

  it("aucun secret n'est posé dans l'env d'un job", () => {
    for (const { file, text } of workflows) {
      expect(misplacedSecrets(text), file).toEqual([]);
    }
  });

  it("repère un secret posé dans l'env d'un job", () => {
    const bad = "jobs:\n  a:\n    env:\n      TOKEN: ${{ secrets.TOKEN }}\n";
    const good =
      "jobs:\n  a:\n    steps:\n      - run: x\n        env:\n          TOKEN: ${{ secrets.TOKEN }}\n";
    expect(misplacedSecrets(bad)).toHaveLength(1);
    expect(misplacedSecrets(good)).toEqual([]);
  });

  it("chaque checkout retire le jeton de la config git", () => {
    for (const { file, text } of workflows) {
      expect(keptCredentials(text), file).toEqual([]);
    }
  });

  it("repère un checkout qui garde le jeton", () => {
    const kept = "      - uses: actions/checkout@x\n      - run: npm ci\n";
    const dropped =
      "      - uses: actions/checkout@x\n        with:\n          persist-credentials: false\n      - run: npm ci\n";
    const nextSays =
      "      - uses: actions/checkout@x\n      - uses: y\n        with:\n          persist-credentials: false\n";
    expect(keptCredentials(kept)).toHaveLength(1);
    expect(keptCredentials(dropped)).toEqual([]);
    expect(keptCredentials(nextSays)).toHaveLength(1);
  });

  it("repère une action non épinglée", () => {
    const bad = "      - uses: actions/checkout@v4\n";
    const good = `      - uses: actions/checkout@${"a".repeat(40)} # v4.0.0\n`;
    expect(unpinned(bad)).toHaveLength(1);
    expect(unpinned(good)).toEqual([]);
  });
});

describe("le workflow de nuit (nightly.yml)", () => {
  const nightly = readFileSync(`${DIR}/nightly.yml`, "utf8");

  it("la sauvegarde de nuit attend une livraison en cours", () => {
    const backup = job(nightly, "backup");
    expect(backup).toMatch(/group: production/);
    expect(backup).toMatch(/cancel-in-progress: false/);
  });

  it("l'exercice de restauration ne voit aucun secret de base de prod", () => {
    const drill = job(nightly, "restore-drill");
    expect(drill).not.toContain("secrets.DATABASE_URL");
    expect(drill).not.toContain("secrets.DATABASE_AUTH_TOKEN");
  });

  it("la fumée de nuit n'appelle pas le cron", () => {
    const smoke = job(nightly, "smoke");
    expect(smoke).toContain("SMOKE_CRON: skip");
    expect(smoke).not.toContain("secrets.");
  });
});
