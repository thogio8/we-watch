// A worker thread that swipes « ON LE VEUT » on a shared SQLite file, for
// tests/helpers/race.ts. Native SQLite waits for a lock synchronously: two
// transactions of one thread would block each other, so each racer gets a
// thread (and a connection) of its own. Loaded by Node itself, not Vitest:
// TypeScript is stripped natively and the hook below resolves the `@/`
// alias and extensionless imports of the sources.
//
// Limits of loading `src` this way, for whoever extends what it imports: Node
// only strips erasable TypeScript (no `enum`, parameter properties,
// `namespace` or other syntax that emits code), the hook only adds `.ts` to
// a file import (no directory `index` import, no explicit `.js` extension),
// and nothing stubs `import "server-only"`, which throws here: the worker
// then fails to load and `race` rejects.
import { registerHooks } from "node:module";
import { parentPort, workerData } from "node:worker_threads";
import type { MovieSnapshot } from "@/domain/movie";
import type { SwipeOutcome } from "@/domain/transitions";

const SRC = new URL("../../src/", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    // Only the sources' own imports: dependencies resolve as usual.
    if (context.parentURL?.endsWith(".ts") !== true) {
      return nextResolve(specifier, context);
    }
    const target = specifier.startsWith("@/")
      ? new URL(specifier.slice(2), SRC).href
      : specifier;
    const local = target.startsWith(".") || target.startsWith("file:");
    return nextResolve(local ? `${target}.ts` : target, context);
  },
});

export interface SwiperData {
  url: string;
  groupId: string;
  userId: string;
  snapshots: MovieSnapshot[];
  /** One slot per round: both racers wait there before swiping. */
  gate: SharedArrayBuffer;
}

/** What one racer saw in one round, times in ms since the epoch. */
export interface Lap {
  outcome: SwipeOutcome;
  start: number;
  end: number;
}

const { createDatabase } = await import("@/db/create-database");
const { createDecisions } = await import("@/db/decisions");

const data = workerData as SwiperData;
const decisions = createDecisions(createDatabase(data.url));
const gate = new Int32Array(data.gate);
const clock = () => performance.timeOrigin + performance.now();

/** Both racers leave slot `round` together. */
function startLine(round: number) {
  Atomics.add(gate, round, 1);
  Atomics.notify(gate, round);
  while (Atomics.load(gate, round) < 2) Atomics.wait(gate, round, 1, 50);
}

const laps: Lap[] = [];
for (const [round, snapshot] of data.snapshots.entries()) {
  startLine(round);
  const start = clock();
  const outcome = await decisions.swipe({
    groupId: data.groupId,
    userId: data.userId,
    tmdbId: snapshot.tmdbId,
    decision: "keep",
    snapshot,
  });
  laps.push({ outcome, start, end: clock() });
}
parentPort?.postMessage(laps);
