"use client";

import { useRouter } from "next/navigation";
import { useId } from "react";
import { TOO_MANY_ATTEMPTS } from "@/domain/rate-limit";
import { ConfirmButton } from "@/ui/ConfirmButton";
import sheet from "@/ui/Sheet.module.css";
import styles from "./Account.module.css";
import type { DeletePasskeyResult } from "./actions";
import type { MyPasskey } from "./load";
import { AddPasskey } from "./AddPasskey";
import { ListSection } from "./ListSection";
import {
  addedOn,
  CONFIRM_WITH_PASSKEY,
  GONE_PASSKEY,
  LAST_PASSKEY,
  REMOVE_PASSKEY_FAILED,
  REMOVE_PASSKEY_WARNING,
  removePasskeyQuestion,
} from "./messages";
import {
  confirmThenReplay,
  refusedAsStale,
  type Reconfirm,
} from "./recent-sign-in";
import { useListNotice } from "./useListNotice";

const REFUSALS = {
  last: LAST_PASSKEY,
  not_found: GONE_PASSKEY,
  too_many: TOO_MANY_ATTEMPTS,
  // Only if the replay, after the device lock, were refused again.
  stale: CONFIRM_WITH_PASSKEY,
} as const;

interface PasskeyRowProps {
  passkey: MyPasskey;
  /** The only one left: kept, so no « SUPPRIMER ». */
  last: boolean;
  remove: (id: string) => Promise<DeletePasskeyResult>;
  reconfirm: Reconfirm;
  /** The outcome to show above the list (null: none), the row may go. */
  onSettled: (notice: string | null) => void;
  onDone: () => void;
}

function PasskeyRow({
  passkey,
  last,
  remove,
  reconfirm,
  onSettled,
  onDone,
}: PasskeyRowProps) {
  const router = useRouter();
  const nameId = useId();
  const removeIt = async () => {
    // A throw (network, database) is left to the ticket: REMOVE_PASSKEY_FAILED.
    const confirmed = await confirmThenReplay(
      () => remove(passkey.id),
      refusedAsStale,
      reconfirm,
    );
    // The device lock not given: the ticket stays open, with why.
    if (!confirmed.done) return confirmed.error;
    const result = confirmed.outcome;
    if (result.ok) {
      onSettled(null);
      return;
    }
    onSettled(REFUSALS[result.reason]);
    // Refused (the last one, another tab) or gone already: the list is
    // stale, and reloading it may take this row along with the ticket.
    // Past the attempt limit (or stale), nothing changed.
    if (result.reason === "last" || result.reason === "not_found") {
      router.refresh();
    }
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
  remove: (id: string) => Promise<DeletePasskeyResult>;
  /** An old session asks the device lock again (confirmThenReplay). */
  reconfirm: Reconfirm;
}

/** « TES CLÉS D’ACCÈS »: each one, then a new one from this device. */
export function PasskeyList({ passkeys, remove, reconfirm }: PasskeyListProps) {
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
          {/* A new key settles any earlier outcome (e.g. « GARDE AU MOINS… »). */}
          <AddPasskey onAdded={() => setNotice(null)} reconfirm={reconfirm} />
        </>
      }
    >
      {passkeys.map((passkey) => (
        <PasskeyRow
          key={passkey.id}
          passkey={passkey}
          last={last}
          remove={remove}
          reconfirm={reconfirm}
          onSettled={setNotice}
          // The row may go with its button: the focus goes to the title.
          onDone={focusTitle}
        />
      ))}
    </ListSection>
  );
}
