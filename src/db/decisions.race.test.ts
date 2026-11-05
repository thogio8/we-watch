import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { aFileDatabase, aGroup, aUser } from "@tests/helpers/groups";
import { aSnapshot } from "@tests/helpers/movies";
import { overlap, race } from "@tests/helpers/race";
import { createDecisions } from "./decisions";
import { groupMovie, movieWant } from "./group-schema";

const ROUNDS = 10;

describe("poser un match en concurrence", () => {
  it("deux derniers swipes simultanés : un seul matched: true, un seul match en base", async () => {
    const { url, db } = await aFileDatabase();
    const [lea, hugo, sam] = [
      await aUser(db, "Léa"),
      await aUser(db, "Hugo"),
      await aUser(db, "Sam"),
    ];
    const groupId = await aGroup(db, "TOUS", [lea, hugo, sam]);
    const snapshots = Array.from({ length: ROUNDS }, (_, i) =>
      aSnapshot(i + 1),
    );
    for (const snapshot of snapshots) {
      await createDecisions(db).swipe({
        groupId,
        userId: sam,
        tmdbId: snapshot.tmdbId,
        decision: "keep",
        snapshot,
      });
    }

    const [leaLaps, hugoLaps] = await race({
      url,
      groupId,
      racers: [lea, hugo],
      snapshots,
    });

    const rows = await db
      .select({
        tmdbId: groupMovie.tmdbId,
        matchedAt: groupMovie.matchedAt,
        matchedBy: groupMovie.matchedBy,
      })
      .from(groupMovie)
      .where(eq(groupMovie.groupId, groupId))
      .orderBy(groupMovie.tmdbId);
    const wishes = await db.select().from(movieWant);
    expect(rows).toHaveLength(ROUNDS);
    rows.forEach((row, round) => {
      const laps = [leaLaps![round]!, hugoLaps![round]!];
      expect(laps.map((l) => l.outcome.result)).toEqual(["applied", "applied"]);
      const winners = [lea, hugo].filter((_, i) => laps[i]!.outcome.matched);
      expect(winners).toEqual([row.matchedBy]);
      const winnerWish = wishes.find(
        (w) => w.tmdbId === row.tmdbId && w.userId === row.matchedBy,
      );
      expect(row.matchedAt).toEqual(winnerWish?.wantedAt);
    });
    // The rounds really ran at the same time (a thread and a connection
    // each, SQLite's lock deciding who writes first).
    expect(leaLaps!.some((lap, round) => overlap(lap, hugoLaps![round]!))).toBe(
      true,
    );
  });
});
