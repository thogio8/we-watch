import { connection } from "next/server";
import { Suspense } from "react";
import { ListScreen, ListScreenFallback } from "@/features/list/ListScreen";
import {
  addFromSearch,
  removeFromList,
  searchCatalog,
  unwatch,
} from "@/features/list/actions";
import { getMoviesRepository } from "@/server/container";

/** Reads both lists on every request. No TMDB call here: the actions re-render this page (R10). */
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
      search={{ search: searchCatalog, add: addFromSearch }}
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
