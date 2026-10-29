import { connection } from "next/server";
import { Suspense } from "react";
import { DrawScreen, DrawScreenFallback } from "@/features/draw/DrawScreen";
import { markWatched } from "@/features/draw/actions";
import { chooseGroup, createGroup } from "@/features/groups/actions";
import { FirstGroupScreen } from "@/features/groups/FirstGroupScreen";
import { GroupPill, GroupPillFallback } from "@/features/groups/GroupPill";
import { getGroupList } from "@/server/container";
import { getActiveGroup } from "@/server/groups";

/** Reads the displayed group's list on every request (the database is not a fetch Next can see). */
async function DrawData() {
  await connection();
  const active = await getActiveGroup();
  if (!active?.group) return <FirstGroupScreen create={createGroup} />;
  const groupId = active.group.id;
  const list = getGroupList();
  const [toWatch, counts] = await Promise.all([
    list.listByStatus(groupId, "to_watch"),
    list.counts(groupId),
  ]);
  return (
    // The pill stays outside the draw's animated screens.
    <>
      <GroupPill
        active={active.group}
        groups={active.groups}
        choose={chooseGroup}
        create={createGroup}
      />
      <DrawScreen
        toWatch={toWatch}
        counts={counts}
        onWatched={markWatched.bind(null, groupId)}
      />
    </>
  );
}

export default function DrawPage() {
  return (
    <Suspense
      fallback={
        <>
          <GroupPillFallback />
          <DrawScreenFallback />
        </>
      }
    >
      <DrawData />
    </Suspense>
  );
}
