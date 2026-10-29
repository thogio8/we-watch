import { connection } from "next/server";
import { Suspense } from "react";
import { markWatched } from "@/features/draw/actions";
import { FirstGroup } from "@/features/groups/FirstGroup";
import { removeFromList, unwatch } from "@/features/list/actions";
import { loadMoviePage } from "@/features/movie/load";
import {
  MovieNotFound,
  MovieScreen,
  MovieScreenFallback,
} from "@/features/movie/MovieScreen";
import { getActiveGroup } from "@/server/groups";

async function MovieData({
  params,
}: Pick<PageProps<"/list/[tmdbId]">, "params">) {
  await connection();
  const active = await getActiveGroup();
  if (!active?.group) return <FirstGroup />;
  const groupId = active.group.id;
  // Only a movie of the displayed group: another group's id is not found.
  const page = await loadMoviePage(groupId, (await params).tmdbId);
  if (page === null) return <MovieNotFound />;
  return (
    <MovieScreen
      movie={page.movie}
      credits={page.credits}
      actions={{
        onWatched: markWatched.bind(null, groupId),
        onUnwatch: unwatch.bind(null, groupId),
        onRemove: removeFromList.bind(null, groupId),
      }}
    />
  );
}

export default function MoviePage({ params }: PageProps<"/list/[tmdbId]">) {
  return (
    <Suspense fallback={<MovieScreenFallback />}>
      <MovieData params={params} />
    </Suspense>
  );
}
