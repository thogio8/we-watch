"use client";

import { useRouter } from "next/navigation";
import { useId } from "react";
import { ConfirmButton } from "@/ui/ConfirmButton";
import sheet from "@/ui/Sheet.module.css";
import styles from "./Account.module.css";
import type { AccountResult, MyPasskey } from "./actions";
import { AddPasskey } from "./AddPasskey";
import { ListSection } from "./ListSection";
import {
  addedOn,
  GONE_PASSKEY,
  LAST_PASSKEY,
  REMOVE_PASSKEY_FAILED,
  REMOVE_PASSKEY_WARNING,
  removePasskeyQuestion,
} from "./messages";
import { useListNotice } from "./useListNotice";

interface PasskeyRowProps {
  passkey: MyPasskey;
  /** The only one left: kept, so no « SUPPRIMER ». */
  last: boolean;
  remove: (id: string) => Promise<AccountResult>;
  /** The outcome to show above the list (null: none), the row may go. */
  onSettled: (notice: string | null) => void;
  onDone: () => void;
}

function PasskeyRow({
  passkey,
  last,
  remove,
  onSettled,
  onDone,
}: PasskeyRowProps) {
  const router = useRouter();
  const nameId = useId();
  const removeIt = async () => {
    const result = await remove(passkey.id).catch(() => null);
    if (result?.ok) {
      onSettled(null);
      return;
    }
    // Refused (the last one, another tab) or gone already: the list is
    // stale, and reloading it may take this row along with the ticket.
    onSettled(result === null ? GONE_PASSKEY : result.error);
    router.refresh();
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
          onDone={onDone}
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
  const { title, notice, setNotice, focusTitle } = useListNotice();
  const last = passkeys.length === 1;
  return (
    <ListSection
      title="TES CLÉS D’ACCÈS"
      titleRef={title}
      notice={notice}
      after={
        <>
          {last && notice !== LAST_PASSKEY && (
            <p className={styles.last}>{LAST_PASSKEY}</p>
          )}
          <AddPasskey />
        </>
      }
    >
      {passkeys.map((passkey) => (
        <PasskeyRow
          key={passkey.id}
          passkey={passkey}
          last={last}
          remove={remove}
          onSettled={setNotice}
          // The row may go with its button: the focus goes to the title.
          onDone={focusTitle}
        />
      ))}
    </ListSection>
  );
}
