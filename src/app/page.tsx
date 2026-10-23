import { connection } from "next/server";
import { Suspense } from "react";
import { DrawScreen, DrawScreenFallback } from "@/features/draw/DrawScreen";
import { markWatched } from "@/features/draw/actions";
import { getMoviesRepository } from "@/server/container";

/** Reads the list on every request (the database is not a fetch Next can see). */
async function DrawData() {
  await connection();
  const repository = getMoviesRepository();
  const [toWatch, counts] = await Promise.all([
    repository.listByStatus("to_watch"),
    repository.counts(),
  ]);
  return (
    <DrawScreen toWatch={toWatch} counts={counts} onWatched={markWatched} />
  );
}

export default function DrawPage() {
  return (
    <Suspense fallback={<DrawScreenFallback />}>
      <DrawData />
    </Suspense>
  );
}
