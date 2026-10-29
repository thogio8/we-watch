"use client";

import { type FormEvent, useId, useRef, useState } from "react";
import { parseGroupName } from "@/domain/group";
import { Button } from "@/ui/Button";
import type { CreateGroupResult } from "./actions";
import styles from "./CreateGroupForm.module.css";
import { CREATE_FAILED, GROUP_NAME_ERROR } from "./messages";

interface CreateGroupFormProps {
  create: (formData: FormData) => Promise<CreateGroupResult>;
  /** The group exists and is now the displayed one. */
  onCreated: (groupId: string) => void;
}

/**
 * « NOM DU GROUPE » then « CRÉER LE GROUPE ». The name is checked here first
 * (same rule as the server), and a pending send ignores further submits.
 */
export function CreateGroupForm({ create, onCreated }: CreateGroupFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const sending = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const errorId = useId();

  const fail = (message: string) => {
    setError(message);
    input.current?.focus();
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    const formData = new FormData(event.currentTarget);
    if (parseGroupName(formData.get("name")) === null) {
      fail(GROUP_NAME_ERROR);
      return;
    }
    sending.current = true;
    setPending(true);
    const result = await create(formData).catch(() => null);
    sending.current = false;
    setPending(false);
    if (result?.ok) {
      onCreated(result.groupId);
      return;
    }
    fail(result?.error ?? CREATE_FAILED);
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <label className={styles.label}>
        NOM DU GROUPE
        <input
          ref={input}
          className={styles.input}
          name="name"
          autoComplete="off"
          aria-invalid={error === null ? undefined : true}
          aria-describedby={error === null ? undefined : errorId}
        />
      </label>
      {error !== null && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
      <Button
        type="submit"
        variant="primary"
        className={styles.submit}
        disabled={pending}
      >
        CRÉER LE GROUPE
      </Button>
    </form>
  );
}
