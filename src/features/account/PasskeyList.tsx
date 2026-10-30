"use client";

import { useRouter } from "next/navigation";
import { useId, useRef } from "react";
import { ConfirmButton } from "@/ui/ConfirmButton";
import sheet from "@/ui/Sheet.module.css";
import styles from "./Account.module.css";
import type { AccountResult, MyPasskey } from "./actions";
import { AddPasskey } from "./AddPasskey";
import {
  addedOn,
  LAST_PASSKEY,
  REMOVE_PASSKEY_FAILED,
  REMOVE_PASSKEY_WARNING,
  removePasskeyQuestion,
} from "./messages";

interface PasskeyRowProps {
  passkey: MyPasskey;
  /** The only one left: kept, so no « SUPPRIMER ». */
  last: boolean;
  remove: (id: string) => Promise<AccountResult>;
  onRemoved: () => void;
}

function PasskeyRow({ passkey, last, remove, onRemoved }: PasskeyRowProps) {
  const router = useRouter();
  const nameId = useId();
  // Refused (the last one) or failed (gone already?): the list may be stale.
  const removeIt = async () => {
    const result = await remove(passkey.id).catch((error: unknown) => {
      router.refresh();
      throw error;
    });
    if (result.ok) return;
    router.refresh();
    return result.error;
  };
  return (
    <li className={sheet.row} aria-labelledby={nameId}>
      <p className={sheet.who}>
        <span id={nameId} className={sheet.rowName}>
          {passkey.name}
        </span>
        {passkey.createdAt && (
          <small className={sheet.rowNote}>{addedOn(passkey.createdAt)}</small>
        )}
      </p>
      {!last && (
        <ConfirmButton
          small
          label="SUPPRIMER"
          question={removePasskeyQuestion(passkey.name)}
          warning={REMOVE_PASSKEY_WARNING}
          confirmLabel="SUPPRIMER"
          action={removeIt}
          failure={REMOVE_PASSKEY_FAILED}
          onDone={onRemoved}
        />
      )}
    </li>
  );
}

interface PasskeyListProps {
  passkeys: MyPasskey[];
  remove: (id: string) => Promise<AccountResult>;
}

/** « TES CLÉS D’ACCÈS »: each one, then a new one from this device. */
export function PasskeyList({ passkeys, remove }: PasskeyListProps) {
  const titleId = useId();
  const title = useRef<HTMLHeadingElement>(null);
  const last = passkeys.length === 1;
  return (
    <section className={sheet.sheet} aria-labelledby={titleId}>
      <h2 ref={title} id={titleId} className={sheet.title} tabIndex={-1}>
        TES CLÉS D’ACCÈS
      </h2>
      <ul className={sheet.rows} aria-labelledby={titleId}>
        {passkeys.map((passkey) => (
          <PasskeyRow
            key={passkey.id}
            passkey={passkey}
            last={last}
            remove={remove}
            // The row goes with its button: the focus goes to the title.
            onRemoved={() => title.current?.focus()}
          />
        ))}
      </ul>
      {last && <p className={styles.last}>{LAST_PASSKEY}</p>}
      <AddPasskey />
    </section>
  );
}
