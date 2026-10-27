import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

/**
 * Layer rules (CLAUDE.md « Architecture »): each layer lists what it may
 * NOT import. `@/app` is a leaf: nobody imports a route.
 */
const NO_APP = { group: ["@/app", "@/app/*"], message: "Routes are leaves." };
const layer = (files, patterns) => ({
  files,
  rules: {
    "@typescript-eslint/no-restricted-imports": [
      "error",
      { patterns: [NO_APP, ...patterns] },
    ],
  },
});
const only = (allowed, message) => ({
  group: ["@/*", ...allowed.flatMap((dir) => [`!@/${dir}`, `!@/${dir}/*`])],
  message,
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,

  // Clean code, enforced: small files and functions, flat control flow.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      complexity: ["error", 10],
      "max-depth": ["error", 3],
      "max-params": ["error", 4],
      "max-nested-callbacks": ["error", 3],
      "max-lines": [
        "error",
        { max: 200, skipBlankLines: true, skipComments: true },
      ],
      "max-lines-per-function": [
        "error",
        { max: 80, skipBlankLines: true, skipComments: true },
      ],
      eqeqeq: ["error", "always"],
      "no-nested-ternary": "error",
      "no-else-return": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "inline-type-imports" },
      ],
    },
  },
  // Tests read as scenarios: long `describe` blocks are fine.
  {
    files: ["**/*.test.{ts,tsx}", "tests/**", "e2e/**", "**/__mocks__/**"],
    rules: {
      "max-lines": "off",
      "max-lines-per-function": "off",
      "max-nested-callbacks": "off",
    },
  },

  // Playwright fixtures receive a `use` callback: not React's `use` hook.
  {
    files: ["e2e/**"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },

  // Dependency direction: domain ← db/tmdb ← server ← features ← app.
  layer(
    ["src/domain/**"],
    [
      only(["domain"], "domain is pure: no other layer."),
      {
        group: ["react", "react-*", "next", "next/*"],
        message: "domain is pure.",
      },
    ],
  ),
  layer(["src/db/**", "src/tmdb/**"], [only(["domain"], "Only domain below.")]),
  layer(
    ["src/access/**"],
    [only(["domain", "env", "access"], "Access is low-level.")],
  ),
  layer(
    ["src/ui/**"],
    [
      {
        group: [
          "@/db",
          "@/db/*",
          "@/server",
          "@/server/*",
          "@/features",
          "@/features/*",
          "@/env",
        ],
        message: "ui is presentational: data comes in through props.",
      },
    ],
  ),
  layer(
    ["src/features/**"],
    [
      {
        group: ["@/db", "@/db/*"],
        message: "Go through @/server/container (one place wires the DB).",
      },
    ],
  ),
  layer(
    ["src/server/**"],
    [
      {
        group: ["@/features", "@/features/*"],
        allowTypeImports: true,
        message: "server only implements the ports features declare (types).",
      },
    ],
  ),

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
