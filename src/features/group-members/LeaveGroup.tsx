"use client";

import { ConfirmButton } from "@/ui/ConfirmButton";
import { LAST_MEMBER, LEAVE_FAILED, leaveQuestion } from "./messages";

interface LeaveGroupProps {
  groupName: string;
  /** The group and its list go with me. */
  last: boolean;
  leave: () => Promise<void>;
}

/** « QUITTER LE GROUPE », confirmed; then the app, on my next group. */
export function LeaveGroup({ groupName, last, leave }: LeaveGroupProps) {
  return (
    <ConfirmButton
      label="QUITTER LE GROUPE"
      question={leaveQuestion(groupName)}
      warning={last ? LAST_MEMBER : undefined}
      confirmLabel="QUITTER"
      action={async () => {
        await leave();
        // A full load: every page and the pill forget the group.
        window.location.replace("/");
      }}
      failure={LEAVE_FAILED}
      leaves
    />
  );
}
