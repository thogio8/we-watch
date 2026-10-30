"use client";

import { useState } from "react";
import { parseDisplayName } from "@/domain/display-name";
import { NAME_ERROR } from "@/features/signin/messages";
import { LabelForm } from "@/ui/LabelForm";
import styles from "./Account.module.css";
import type { AccountResult } from "./actions";
import { RENAME_FAILED, renamedTo } from "./messages";

interface NameFormProps {
  name: string;
  rename: (formData: FormData) => Promise<AccountResult>;
}

/**
 * « TON PRÉNOM », filled in, then « CHANGER ». The new name is said aloud
 * (a polite status), the focus staying in the form.
 */
export function NameForm({ name, rename }: NameFormProps) {
  const [status, setStatus] = useState("");

  const send = async (formData: FormData) => {
    setStatus("");
    const result = await rename(formData);
    const renamed = parseDisplayName(formData.get("name"));
    if (result.ok && renamed !== null) setStatus(renamedTo(renamed));
    return result;
  };

  return (
    <>
      <LabelForm
        label="TON PRÉNOM"
        parse={parseDisplayName}
        invalid={NAME_ERROR}
        send={send}
        submitLabel="CHANGER"
        failure={RENAME_FAILED}
        defaultName={name}
      />
      <p className={styles.status} role="status">
        {status}
      </p>
    </>
  );
}
