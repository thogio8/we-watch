"use client";

import { useRouter } from "next/navigation";
import { useId, useRef } from "react";
import { SIGNIN_PATH } from "@/access/paths";
import { ConfirmButton } from "@/ui/ConfirmButton";
import sheet from "@/ui/Sheet.module.css";
import type { MySession } from "./actions";
import {
  activeOn,
  REVOKE_FAILED,
  revokeQuestion,
  THIS_DEVICE,
  THIS_DEVICE_WARNING,
} from "./messages";

interface DeviceRowProps {
  session: MySession;
  revoke: (id: string) => Promise<boolean>;
  onRevoked: () => void;
}

function DeviceRow({ session, revoke, onRevoked }: DeviceRowProps) {
  const router = useRouter();
  const nameId = useId();
  const { current } = session;
  const revokeIt = async () => {
    const revoked = await revoke(session.id);
    if (current) {
      // Signed out here too: replace, so Back does not return into the app.
      window.location.replace(SIGNIN_PATH);
    } else if (!revoked) {
      // Signed out elsewhere already: nothing was revalidated.
      router.refresh();
    }
  };
  return (
    <li className={sheet.row} aria-labelledby={nameId}>
      <p className={sheet.who}>
        <span id={nameId} className={sheet.rowName}>
          {session.device}
        </span>
        {current && <span className={sheet.badge}>{THIS_DEVICE}</span>}
        <small className={sheet.rowNote}>
          {activeOn(session.lastActiveAt)}
        </small>
      </p>
      <ConfirmButton
        small
        label="DÉCONNECTER"
        question={revokeQuestion(session.device)}
        warning={current ? THIS_DEVICE_WARNING : undefined}
        confirmLabel="DÉCONNECTER"
        action={revokeIt}
        failure={REVOKE_FAILED}
        leaves={current}
        onDone={onRevoked}
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
  const titleId = useId();
  const title = useRef<HTMLHeadingElement>(null);
  return (
    <section className={sheet.sheet} aria-labelledby={titleId}>
      <h2 ref={title} id={titleId} className={sheet.title} tabIndex={-1}>
        TES APPAREILS
      </h2>
      <ul className={sheet.rows} aria-labelledby={titleId}>
        {sessions.map((session) => (
          <DeviceRow
            key={session.id}
            session={session}
            revoke={revoke}
            // The row goes with its button: the focus goes to the title.
            onRevoked={() => title.current?.focus()}
          />
        ))}
      </ul>
    </section>
  );
}
