import { describe, expect, it } from "vitest";
import { hasMisplacedDirective, isServerModule } from "./server-directive";

const HEAD = '"use server";\n\nexport async function a() {}\n';

describe("directive « use server »", () => {
  it.each([
    ["en première ligne", HEAD],
    [
      "entre apostrophes, sans point-virgule",
      "'use server'\nexport const a = 1;\n",
    ],
    [
      "après des commentaires",
      '// Actions.\n/* LISTE */\n"use server";\nexport {};\n',
    ],
    ["après un commentaire sur la même ligne", '/* LISTE */ "use server";\n'],
  ])("module d’actions : %s", (_, text) => {
    expect(isServerModule(text)).toBe(true);
    expect(hasMisplacedDirective(text)).toBe(false);
  });

  it.each([
    ["après un import", 'import x from "x";\n"use server";\n'],
    ["dans une fonction", 'export async function a() {\n  "use server";\n}\n'],
    [
      "dans une fonction d’une ligne",
      'const a = async () => { "use server"; return 1; };\n',
    ],
    ["après une instruction sur la même ligne", 'f(); "use server";\n'],
    [
      "une seconde fois dans un module d’actions",
      `${HEAD}function b() { 'use server' }\n`,
    ],
  ])("refusée : %s", (_, text) => {
    expect(hasMisplacedDirective(text)).toBe(true);
  });

  it.each([
    ["dans un commentaire", '// "use server" only in the head\nexport {};\n'],
    ["dans une chaîne", 'const a = ["use server", 1];\nlog("use server");\n'],
  ])("ignorée : %s", (_, text) => {
    expect(isServerModule(text)).toBe(false);
    expect(hasMisplacedDirective(text)).toBe(false);
  });
});
