"use client";

import { type ReactNode, useId, useRef } from "react";
import type { GroupSummary } from "@/domain/group";
import type { RenameResult } from "@/features/groups/actions";
import { Headline } from "@/ui/Headline";
import styles from "./GroupScreen.module.css";
import { InviteLink } from "./InviteLink";
import { LeaveGroup } from "./LeaveGroup";
import { type GroupMember, MemberList } from "./MemberList";
import { RenameForm } from "./RenameForm";

/** The actions of features/groups, bound by the page to the displayed group. */
export interface GroupActions {
  rename: (formData: FormData) => Promise<RenameResult>;
  inviteLink: () => Promise<string>;
  regenerateInviteLink: () => Promise<string>;
  removeMember: (userId: string) => Promise<void>;
  leaveGroup: () => Promise<void>;
}

interface GroupScreenProps {
  group: GroupSummary;
  /** My user id. */
  me: string;
  /** Oldest first. */
  members: GroupMember[];
  actions: GroupActions;
  /** The group pill, first in the landmark. */
  pill?: ReactNode;
}

const TITLE = ["MEMBRES ET", "INVITATION"] as const;

/** « MEMBRES ET INVITATION »: the name, the members, the link, leaving. */
export function GroupScreen({
  group,
  me,
  members,
  actions,
  pill,
}: GroupScreenProps) {
  const membersId = useId();
  const membersTitle = useRef<HTMLHeadingElement>(null);
  // A new name remounts the form, a removed member takes his row along: the
  // focus goes to this title, which stays.
  const focusMembers = () => membersTitle.current?.focus();
  return (
    <main className={styles.screen}>
      {pill}
      <Headline lines={TITLE} size="medium" />
      <div className={styles.sheet}>
        {/* A new name (or another group) comes back from the server. */}
        <RenameForm
          key={`${group.id}:${group.name}`}
          name={group.name}
          rename={actions.rename}
          onDone={focusMembers}
        />
      </div>
      <section className={styles.sheet} aria-labelledby={membersId}>
        <h2
          ref={membersTitle}
          id={membersId}
          className={styles.title}
          tabIndex={-1}
        >
          MEMBRES
        </h2>
        <MemberList
          members={members}
          me={me}
          remove={actions.removeMember}
          labelledBy={membersId}
          onRemoved={focusMembers}
        />
        <InviteLink
          key={group.id}
          load={actions.inviteLink}
          regenerate={actions.regenerateInviteLink}
        />
      </section>
      <div className={styles.leave}>
        <LeaveGroup
          key={group.id}
          groupName={group.name}
          last={members.length === 1}
          leave={actions.leaveGroup}
        />
      </div>
    </main>
  );
}

/** Shown while the group loads: the title alone. */
export function GroupScreenFallback({ pill }: { pill?: ReactNode }) {
  return (
    <main className={styles.screen} aria-busy="true">
      {pill}
      <Headline lines={TITLE} size="medium" />
    </main>
  );
}
