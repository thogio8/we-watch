"use client";

import { useRouter } from "next/navigation";
import { useId } from "react";
import { SIGNIN_PATH } from "@/access/paths";
import { ConfirmButton } from "@/ui/ConfirmButton";
import sheet from "@/ui/Sheet.module.css";
import type { MySession } from "./actions";
import { ListSection } from "./ListSection";
import {
  activeOn,
  alreadyRevoked,
  REVOKE_FAILED,
  revokeQuestion,
  THIS_DEVICE,
  THIS_DEVICE_WARNING,
} from "./messages";
import { useListNotice } from "./useListNotice";

interface DeviceRowProps {
  session: MySession;
  revoke: (id: string) => Promise<boolean>;
  /** The outcome to show above the list (null: none), the row may go. */
  onSettled: (notice: string | null) => void;
  onDone: () => void;
}

function DeviceRow({ session, revoke, onSettled, onDone }: DeviceRowProps) {
  const router = useRouter();
  const nameId = useId();
  const { current, device } = session;
  const revokeIt = async () => {
    const revoked = await revoke(session.id);
    if (current) {
      // Signed out here too: replace, so Back does not return into the app.
      window.location.replace(SIGNIN_PATH);
      return;
    }
    onSettled(revoked ? null : alreadyRevoked(device));
    // Signed out elsewhere already: nothing was revalidated.
    if (!revoked) router.refresh();
  };
  return (
    <li className={sheet.row} aria-labelledby={nameId}>
      <p className={sheet.who}>
        <span id={nameId} className={sheet.rowName}>
          {device}
        </span>
        {current && <span className={sheet.badge}>{THIS_DEVICE}</span>}
        <small className={sheet.rowNote}>
          {activeOn(session.lastActiveAt)}
        </small>
      </p>
      <ConfirmButton
        small
        label="DÉCONNECTER"
        question={revokeQuestion(device)}
        warning={current ? THIS_DEVICE_WARNING : undefined}
        confirmLabel="DÉCONNECTER"
        action={revokeIt}
        failure={REVOKE_FAILED}
        leaves={current}
        onDone={onDone}
      />
    </li>
  );
}

interface DeviceListProps {
  /** Last active first. */
  sessions: MySession[];
  revoke: (id: string) => Promise<boolean>;
}

/** « TES APPAREILS »: where I am signed in, each one signed out on demand. */
export function DeviceList({ sessions, revoke }: DeviceListProps) {
  const { title, notice, setNotice, focusTitle } = useListNotice();
  return (
    <ListSection title="TES APPAREILS" titleRef={title} notice={notice}>
      {sessions.map((session) => (
        <DeviceRow
          key={session.id}
          session={session}
          revoke={revoke}
          onSettled={setNotice}
          // The row goes with its button: the focus goes to the title.
          onDone={focusTitle}
        />
      ))}
    </ListSection>
  );
}
