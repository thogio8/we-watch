"use client";

import { useId } from "react";
import { ConfirmButton } from "@/ui/ConfirmButton";
import styles from "./GroupScreen.module.css";
import {
  memberSince,
  REMOVE_FAILED,
  removeQuestion,
  removeWarning,
} from "./messages";

export type GroupMember = { userId: string; name: string; joinedAt: Date };

interface MemberRowProps {
  member: GroupMember;
  isMe: boolean;
  remove: (userId: string) => Promise<void>;
  onRemoved: () => void;
}

/** « Léa · toi · depuis le 23/10 », « RETIRER » on the others. */
function MemberRow({ member, isMe, remove, onRemoved }: MemberRowProps) {
  const nameId = useId();
  return (
    <li className={styles.member} aria-labelledby={nameId}>
      <p className={styles.who}>
        <span id={nameId} className={styles.name}>
          {member.name}
        </span>
        {isMe && <span className={styles.me}>toi</span>}
        <small className={styles.since}>{memberSince(member.joinedAt)}</small>
      </p>
      {/* Myself: « QUITTER LE GROUPE », below the list. */}
      {!isMe && (
        <ConfirmButton
          small
          label="RETIRER"
          question={removeQuestion(member.name)}
          warning={removeWarning(member.name)}
          confirmLabel="RETIRER"
          action={() => remove(member.userId)}
          failure={REMOVE_FAILED}
          onDone={onRemoved}
        />
      )}
    </li>
  );
}

interface MemberListProps {
  members: GroupMember[];
  me: string;
  remove: (userId: string) => Promise<void>;
  /** The id of the « MEMBRES » title. */
  labelledBy: string;
  /** The removed row and its button go: where the focus goes instead. */
  onRemoved: () => void;
}

export function MemberList({
  members,
  me,
  remove,
  labelledBy,
  onRemoved,
}: MemberListProps) {
  return (
    <ul className={styles.members} aria-labelledby={labelledBy}>
      {members.map((member) => (
        <MemberRow
          key={member.userId}
          member={member}
          isMe={member.userId === me}
          remove={remove}
          onRemoved={onRemoved}
        />
      ))}
    </ul>
  );
}
