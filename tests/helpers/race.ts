import { Worker } from "node:worker_threads";
import type { MovieSnapshot } from "@/domain/movie";
import type { Lap, SwiperData } from "./race-swiper";

interface Race {
  url: string;
  groupId: string;
  racers: readonly string[];
  snapshots: MovieSnapshot[];
}

/** The worker's one message; an error, or an exit before it, rejects. */
function resultOf<T>(worker: Worker): Promise<T> {
  return new Promise((resolve, reject) => {
    worker.once("message", resolve);
    worker.once("error", reject);
    // Settled already when a message came first: then this is a no-op.
    worker.once("exit", (code) =>
      reject(new Error(`worker exited (code ${code}) without a result`)),
    );
  });
}

/**
 * One worker thread per `workerData`, each running `script`: their messages,
 * in order. The first failure rejects at once, and no worker outlives the
 * call (none left waiting for a racer that died).
 */
export async function runWorkers<T>(
  script: URL,
  data: readonly unknown[],
): Promise<T[]> {
  const workers = data.map(
    (workerData) =>
      new Worker(script, {
        workerData,
        // The sources are ES modules in a package without "type": "module".
        execArgv: ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON"],
      }),
  );
  try {
    return await Promise.all(workers.map((worker) => resultOf<T>(worker)));
  } finally {
    await Promise.all(workers.map((worker) => worker.terminate()));
  }
}

/**
 * Each racer, in a thread of its own on the same SQLite file, swipes
 * « ON LE VEUT » on every movie, one round per movie, both starting each
 * round together: their laps, racer by racer.
 */
export function race({ racers, snapshots, ...where }: Race) {
  const gate = new SharedArrayBuffer(4 * snapshots.length);
  const data: SwiperData[] = racers.map((userId) => ({
    ...where,
    userId,
    snapshots,
    gate,
  }));
  return runWorkers<Lap[]>(new URL("./race-swiper.ts", import.meta.url), data);
}

/** Did two laps run at the same time? */
export const overlap = (a: Lap, b: Lap) => a.start < b.end && b.start < a.end;
