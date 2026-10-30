"use client";

import { type FormEvent, useId, useRef, useState } from "react";
import { parseGroupName } from "@/domain/group";
import { Button } from "@/ui/Button";
import styles from "./GroupNameForm.module.css";
import { GROUP_NAME_ERROR } from "./messages";

type Result = { ok: true } | { ok: false; error: string };

interface GroupNameFormProps<R extends Result> {
  send: (formData: FormData) => Promise<R>;
  /** « CRÉER LE GROUPE », « RENOMMER ». */
  submitLabel: string;
  /** Shown when `send` throws, never its raw text. */
  failure: string;
  defaultName?: string;
  onDone?: (result: Extract<R, { ok: true }>) => void;
}

/**
 * « NOM DU GROUPE » then its button. The name is checked here first (same
 * rule as the server), and a pending send ignores further submits.
 */
export function GroupNameForm<R extends Result>({
  send,
  submitLabel,
  failure,
  defaultName,
  onDone,
}: GroupNameFormProps<R>) {
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
    const result = await send(formData).catch(() => null);
    sending.current = false;
    setPending(false);
    if (result?.ok) {
      setError(null);
      onDone?.(result as Extract<R, { ok: true }>);
      return;
    }
    fail(result?.error ?? failure);
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <label className={styles.label}>
        NOM DU GROUPE
        <input
          ref={input}
          className={styles.input}
          name="name"
          defaultValue={defaultName}
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
        {submitLabel}
      </Button>
    </form>
  );
}
