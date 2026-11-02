import { beforeEach, describe, expect, it } from "vitest";
import { aDatabase } from "@tests/helpers/groups";
import type { Database } from "./create-database";
import { createRateLimits, type RateLimits } from "./rate-limit";
import { rateLimit } from "./rate-limit-schema";

const RULE = { window: 600, max: 3 };
const START = new Date("2026-11-02T20:00:00.000Z");
const later = (seconds: number) => new Date(START.getTime() + seconds * 1000);

let db: Database;
let limits: RateLimits;
beforeEach(async () => {
  db = await aDatabase();
  limits = createRateLimits(db);
});

describe("createRateLimits", () => {
  it("autorise de 1 à max, puis refuse avec les secondes restantes", async () => {
    for (let i = 0; i < RULE.max; i++) {
      expect(await limits.consume("k", RULE, later(i))).toEqual({
        allowed: true,
        retryAfter: null,
      });
    }

    expect(await limits.consume("k", RULE, later(100.2))).toEqual({
      allowed: false,
      retryAfter: 500,
    });
  });

  it("une tentative refusée compte aussi", async () => {
    for (let i = 0; i < RULE.max + 2; i++) {
      await limits.consume("k", RULE, START);
    }

    expect(await db.select().from(rateLimit)).toEqual([
      { key: "k", count: RULE.max + 2, windowStart: START.getTime() },
    ]);
  });

  it("la fenêtre écoulée, le compteur repart à 1", async () => {
    for (let i = 0; i < RULE.max + 1; i++) {
      await limits.consume("k", RULE, START);
    }

    expect(await limits.consume("k", RULE, later(RULE.window))).toEqual({
      allowed: true,
      retryAfter: null,
    });
    expect(await db.select().from(rateLimit)).toEqual([
      { key: "k", count: 1, windowStart: later(RULE.window).getTime() },
    ]);
  });

  it("juste avant la fin de la fenêtre, c'est encore refusé", async () => {
    for (let i = 0; i < RULE.max; i++) {
      await limits.consume("k", RULE, START);
    }

    expect(
      await limits.consume(
        "k",
        RULE,
        new Date(later(RULE.window).getTime() - 1),
      ),
    ).toEqual({ allowed: false, retryAfter: 1 });
  });

  it("deux clés sont indépendantes", async () => {
    for (let i = 0; i < RULE.max + 1; i++) {
      await limits.consume("a", RULE, START);
    }

    expect(await limits.consume("b", RULE, START)).toEqual({
      allowed: true,
      retryAfter: null,
    });
  });

  it("20 tentatives simultanées avec max = 5 : exactement 5 autorisées", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        limits.consume("k", { window: 60, max: 5 }),
      ),
    );

    expect(results.filter(({ allowed }) => allowed)).toHaveLength(5);
  });

  it("sans date, compte à l'heure courante", async () => {
    const before = Date.now();
    await limits.consume("k", RULE);

    const [row] = await db.select().from(rateLimit);
    expect(row?.windowStart).toBeGreaterThanOrEqual(before);
    expect(row?.windowStart).toBeLessThanOrEqual(Date.now());
  });
});
