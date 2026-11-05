import { Worker } from "node:worker_threads";
import type { MovieSnapshot } from "@/domain/movie";
import type { Lap, SwiperData } from "./race-swiper";

interface Race {
  url: string;
  groupId: string;
  racers: readonly string[];
  snapshots: MovieSnapshot[];
}

function runSwiper(data: SwiperData): Promise<Lap[]> {
  const worker = new Worker(new URL("./race-swiper.ts", import.meta.url), {
    workerData: data,
    // The sources are ES modules in a package without "type": "module".
    execArgv: ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON"],
  });
  return new Promise((resolve, reject) => {
    worker.once("message", (laps: Lap[]) => {
      resolve(laps);
      void worker.terminate();
    });
    worker.once("error", reject);
  });
}

/**
 * Each racer, in a thread of its own on the same SQLite file, swipes
 * « ON LE VEUT » on every movie, one round per movie, both starting each
 * round together: their laps, racer by racer.
 */
export function race({ racers, snapshots, ...where }: Race) {
  const gate = new SharedArrayBuffer(4 * snapshots.length);
  return Promise.all(
    racers.map((userId) => runSwiper({ ...where, userId, snapshots, gate })),
  );
}

/** Did two laps run at the same time? */
export const overlap = (a: Lap, b: Lap) => a.start < b.end && b.start < a.end;
