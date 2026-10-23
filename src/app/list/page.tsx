import { connection } from "next/server";
import { Suspense } from "react";
import { ListScreen, ListScreenFallback } from "@/features/list/ListScreen";
import { removeFromList, unwatch } from "@/features/list/actions";
import { getMoviesRepository } from "@/server/container";

/** Reads both lists on every request; no TMDB call here (R10). */
async function ListData() {
  await connection();
  const repository = getMoviesRepository();
  const [toWatch, watched] = await Promise.all([
    repository.listByStatus("to_watch"),
    repository.listByStatus("watched"),
  ]);
  return (
    <ListScreen
      toWatch={toWatch}
      watched={watched}
      onRemove={removeFromList}
      onUnwatch={unwatch}
    />
  );
}

export default function ListPage() {
  return (
    <Suspense fallback={<ListScreenFallback />}>
      <ListData />
    </Suspense>
  );
}
