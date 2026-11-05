// A worker that misbehaves on purpose, for tests/helpers/race.test.ts.
import { parentPort, workerData } from "node:worker_threads";

interface FixtureData {
  mode: "answer" | "throw" | "stall" | "spin";
  /** "spin" counts its turns here, so a test can see it stop. */
  beats: SharedArrayBuffer;
}

const { mode, beats } = workerData as FixtureData;

if (mode === "throw") throw new Error("racer down");
if (mode === "stall") {
  // An unsettled top-level await: the thread exits (code 13), silent.
  await new Promise(() => {});
}
if (mode === "spin") {
  // A racer stuck at the start line, waiting for one that died.
  const turns = new Int32Array(beats);
  for (;;) {
    Atomics.add(turns, 0, 1);
    Atomics.wait(turns, 1, 0, 5);
  }
}
parentPort?.postMessage(mode);
