"use client";

import { useState } from "react";
import { SIGNIN_PATH } from "@/access/paths";
import { confirmsName } from "@/domain/display-name";
import { ConfirmButton } from "@/ui/ConfirmButton";
import styles from "./Account.module.css";
import type { AccountResult } from "./actions";
import {
  DELETE_FAILED,
  DELETE_QUESTION,
  DELETE_WARNING,
  deleteField,
} from "./messages";

interface DeleteAccountProps {
  /** My name, to type before the account goes. */
  name: string;
  remove: (formData: FormData) => Promise<AccountResult>;
}

/**
 * « SUPPRIMER MON COMPTE », strongly confirmed: « SUPPRIMER DÉFINITIVEMENT »
 * waits for my exact name (the server checks it again); then /connexion.
 */
export function DeleteAccount({ name, remove }: DeleteAccountProps) {
  const [typed, setTyped] = useState("");

  const deleteIt = async () => {
    const formData = new FormData();
    formData.set("name", typed);
    const result = await remove(formData);
    if (!result.ok) return result.error;
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
    >
      <label className={styles.field}>
        {deleteField(name)}
        <input
          className={styles.input}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
        />
      </label>
    </ConfirmButton>
  );
}
