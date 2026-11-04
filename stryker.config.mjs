// Mutation testing: measures the strength of the tests, no blocking threshold.
const config = {
  testRunner: "vitest",
  vitest: { configFile: "vitest.config.ts" },
  mutate: [
    "src/domain/**/*.ts",
    "src/features/**/*.ts",
    "!src/**/*.test.ts",
    "!src/**/__mocks__/**",
    "!src/**/use*.ts",
    "!src/**/actions.ts",
    "!src/features/pwa/brand.ts",
    "!src/features/signin/authClient.ts",
  ],
  reporters: ["html", "clear-text", "progress"],
  htmlReporter: { fileName: "reports/mutation/index.html" },
  thresholds: { high: 80, low: 60, break: null },
  incremental: true,
  incrementalFile: "reports/stryker-incremental.json",
  coverageAnalysis: "perTest",
};

export default config;
