import { describe, expect, it } from "vitest";
import { runWorkers } from "./race";

const FIXTURE = new URL("./race-fixture-worker.ts", import.meta.url);

const settle = () => new Promise((resolve) => setTimeout(resolve, 100));

/** Runs the fixture in each mode; `beats` counts the spinning worker's turns. */
function run(...modes: string[]) {
  const beats = new SharedArrayBuffer(8);
  const result = runWorkers(
    FIXTURE,
    modes.map((mode) => ({ mode, beats })),
  );
  return { result, turns: () => Atomics.load(new Int32Array(beats), 0) };
}

describe("runWorkers, le banc des swipes simultanés", () => {
  it("rend le message de chaque worker, dans l’ordre", async () => {
    await expect(run("answer", "answer").result).resolves.toEqual([
      "answer",
      "answer",
    ]);
  });

  it("un worker qui lève fait échouer la course, et l’autre est arrêté", async () => {
    const { result, turns } = run("spin", "throw");

    await expect(result).rejects.toThrow("racer down");

    const stopped = turns();
    await settle();
    expect(turns()).toBe(stopped);
  });

  it("un worker qui s’arrête sans répondre fait échouer la course aussitôt", async () => {
    const { result, turns } = run("spin", "stall");

    await expect(result).rejects.toThrow(
      "worker exited (code 13) without a result",
    );

    const stopped = turns();
    await settle();
    expect(turns()).toBe(stopped);
  });
});
