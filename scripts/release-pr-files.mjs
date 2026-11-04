// Reads, on stdin, the files a pull request changes (one per line). Exit 0
// when every one is a version file (the same list as `paths-ignore` in
// .github/workflows/ci.yml, which tests/scripts/release-pr-files.test.ts
// keeps equal), else exit 1 and name the others. An empty list fails too.
import { readFileSync } from "node:fs";

const VERSION_FILES = [
  "CHANGELOG.md",
  "version.txt",
  ".release-please-manifest.json",
];

const files = readFileSync(0, "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);
const others = files.filter((file) => !VERSION_FILES.includes(file));

if (files.length === 0) {
  console.error("aucun fichier changé : PR de version refusée");
  process.exit(1);
}
if (others.length > 0) {
  console.error(`fichiers hors version :\n${others.join("\n")}`);
  process.exit(1);
}
