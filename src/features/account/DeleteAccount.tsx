"use client";

import { useState } from "react";
import { SIGNIN_PATH } from "@/access/paths";
import { confirmsName } from "@/domain/display-name";
import { ConfirmButton } from "@/ui/ConfirmButton";
import styles from "./Account.module.css";
import type { DeleteAccountResult } from "./actions";
import {
  CONFIRM_WITH_PASSKEY,
  DELETE_FAILED,
  DELETE_QUESTION,
  DELETE_WARNING,
  deleteField,
} from "./messages";
import {
  confirmThenReplay,
  refusedAsStale,
  type Reconfirm,
} from "./recent-sign-in";

interface DeleteAccountProps {
  /** My name, to type before the account goes. */
  name: string;
  remove: (formData: FormData) => Promise<DeleteAccountResult>;
  /** An old session asks the device lock again (confirmThenReplay). */
  reconfirm: Reconfirm;
}

/**
 * « SUPPRIMER MON COMPTE », strongly confirmed: « SUPPRIMER DÉFINITIVEMENT »
 * waits for my exact name (the server checks it again); then /connexion.
 */
export function DeleteAccount({ name, remove, reconfirm }: DeleteAccountProps) {
  const [typed, setTyped] = useState("");

  const deleteIt = async () => {
    const formData = new FormData();
    formData.set("name", typed);
    const confirmed = await confirmThenReplay(
      () => remove(formData),
      refusedAsStale,
      reconfirm,
    );
    // The device lock not given: the ticket, and my name typed, stay.
    if (!confirmed.done) return confirmed.error;
    const result = confirmed.outcome;
    if (!result.ok) {
      return "error" in result ? result.error : CONFIRM_WITH_PASSKEY;
    }
    // Signed out: replace, so Back does not return into the app.
    window.location.replace(SIGNIN_PATH);
  };

  return (
    <ConfirmButton
      label="SUPPRIMER MON COMPTE"
      question={DELETE_QUESTION}
      warning={DELETE_WARNING}
      confirmLabel="SUPPRIMER DÉFINITIVEMENT"
      action={deleteIt}
      failure={DELETE_FAILED}
      ready={confirmsName(typed, name)}
      leaves
      // Reopened, the ticket asks again from scratch.
      onCancel={() => setTyped("")}
    >
      <label className={styles.field}>
        {deleteField(name)}
        <input
          className={styles.input}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
        />
      </label>
    </ConfirmButton>
  );
}
