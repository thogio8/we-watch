import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  GroupScreen,
  GroupScreenFallback,
} from "@/features/group-members/GroupScreen";
import {
  chooseGroup,
  createGroup,
  inviteLink,
  leaveGroup,
  regenerateInviteLink,
  removeMember,
  renameGroup,
} from "@/features/groups/actions";
import { FirstGroupScreen } from "@/features/groups/FirstGroupScreen";
import { GroupPill, GroupPillFallback } from "@/features/groups/GroupPill";
import { APP_NAME } from "@/features/pwa/brand";
import { getGroups } from "@/server/container";
import { getActiveGroup } from "@/server/groups";

export const metadata: Metadata = { title: `Membres · ${APP_NAME}` };

/**
 * The displayed group's members, per request. The invite link is not read
 * here: its first request creates the token, so the screen asks once mounted.
 */
async function GroupData() {
  await connection();
  const active = await getActiveGroup();
  if (!active.group) return <FirstGroupScreen create={createGroup} />;
  const { group, groups, user } = active;
  const members = await getGroups().membersOf(group.id);
  return (
    <GroupScreen
      group={group}
      me={user.userId}
      members={members}
      actions={{
        rename: renameGroup.bind(null, group.id),
        inviteLink: inviteLink.bind(null, group.id),
        regenerateInviteLink: regenerateInviteLink.bind(null, group.id),
        removeMember: removeMember.bind(null, group.id),
        leaveGroup: leaveGroup.bind(null, group.id),
      }}
      pill={
        <GroupPill
          active={group}
          groups={groups}
          choose={chooseGroup}
          create={createGroup}
        />
      }
    />
  );
}

export default function GroupPage() {
  return (
    <Suspense fallback={<GroupScreenFallback pill={<GroupPillFallback />} />}>
      <GroupData />
    </Suspense>
  );
}
