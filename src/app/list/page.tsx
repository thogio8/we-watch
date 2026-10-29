import { connection } from "next/server";
import { Suspense } from "react";
import { chooseGroup, createGroup } from "@/features/groups/actions";
import { FirstGroupScreen } from "@/features/groups/FirstGroupScreen";
import { GroupPill, GroupPillFallback } from "@/features/groups/GroupPill";
import { ListScreen, ListScreenFallback } from "@/features/list/ListScreen";
import {
  addFromSearch,
  removeFromList,
  searchCatalog,
  unwatch,
} from "@/features/list/actions";
import { getGroupList } from "@/server/container";
import { getActiveGroup } from "@/server/groups";

/** Reads both lists of the displayed group on every request. No TMDB call here: the actions re-render this page (R10). */
async function ListData() {
  await connection();
  const active = await getActiveGroup();
  if (!active?.group) return <FirstGroupScreen create={createGroup} />;
  const groupId = active.group.id;
  const list = getGroupList();
  const [toWatch, watched] = await Promise.all([
    list.listByStatus(groupId, "to_watch"),
    list.listByStatus(groupId, "watched"),
  ]);
  return (
    <ListScreen
      toWatch={toWatch}
      watched={watched}
      onRemove={removeFromList.bind(null, groupId)}
      onUnwatch={unwatch.bind(null, groupId)}
      pill={
        <GroupPill
          active={active.group}
          groups={active.groups}
          choose={chooseGroup}
          create={createGroup}
        />
      }
      search={{
        search: searchCatalog.bind(null, groupId),
        add: addFromSearch.bind(null, groupId),
      }}
    />
  );
}

export default function ListPage() {
  return (
    <Suspense fallback={<ListScreenFallback pill={<GroupPillFallback />} />}>
      <ListData />
    </Suspense>
  );
}
