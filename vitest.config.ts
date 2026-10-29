import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      // `server-only` throws outside the Next.js bundler; stub it for tests.
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      // Business scope gated before the front-end work (see global constraints).
      // Every non-UI module: domain, data, server code, and the pure logic
      // and Server Actions of each feature. Components and hooks are
      // covered by the UI and end-to-end tests instead.
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/__mocks__/**",
        "src/**/use*.ts",
        "src/server/container.ts",
        "src/proxy.ts",
        // Pure wiring: Better Auth's handler, tested through createAuth.
        "src/app/api/auth/**/route.ts",
        "src/app/manifest.ts",
        "src/features/pwa/brand.ts",
      ],
      thresholds: { lines: 95, functions: 95, statements: 95, branches: 90 },
    },
  },
});
