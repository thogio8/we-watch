import { connection } from "next/server";
import { Suspense } from "react";
import { DrawScreen, DrawScreenFallback } from "@/features/draw/DrawScreen";
import { markWatched } from "@/features/draw/actions";
import { FirstGroup } from "@/features/groups/FirstGroup";
import { getGroupList } from "@/server/container";
import { getActiveGroup } from "@/server/groups";

/** Reads the displayed group's list on every request (the database is not a fetch Next can see). */
async function DrawData() {
  await connection();
  const active = await getActiveGroup();
  if (!active?.group) return <FirstGroup />;
  const groupId = active.group.id;
  const list = getGroupList();
  const [toWatch, counts] = await Promise.all([
    list.listByStatus(groupId, "to_watch"),
    list.counts(groupId),
  ]);
  return (
    <DrawScreen
      toWatch={toWatch}
      counts={counts}
      onWatched={markWatched.bind(null, groupId)}
    />
  );
}

export default function DrawPage() {
  return (
    <Suspense fallback={<DrawScreenFallback />}>
      <DrawData />
    </Suspense>
  );
}
