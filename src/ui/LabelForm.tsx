"use client";

import { type FormEvent, useId, useRef, useState } from "react";
import { Button } from "./Button";
import styles from "./LabelForm.module.css";

type Result = { ok: true } | { ok: false; error: string };

export interface LabelFormProps<R extends Result> {
  /** The field's label: « NOM DU GROUPE », « TON PRÉNOM ». */
  label: string;
  /** The server's rule, checked here first: the name, or null. */
  parse: (input: unknown) => string | null;
  /** Shown when `parse` refuses. */
  invalid: string;
  send: (formData: FormData) => Promise<R>;
  /** « CRÉER LE GROUPE », « RENOMMER ». */
  submitLabel: string;
  /** Shown when `send` throws, never its raw text. */
  failure: string;
  defaultName?: string;
  onDone?: (result: Extract<R, { ok: true }>) => void;
}

/**
 * A name (field `name`) then its button. The name is checked here first,
 * and a pending send ignores further submits.
 */
export function LabelForm<R extends Result>({
  label,
  parse,
  invalid,
  send,
  submitLabel,
  failure,
  defaultName,
  onDone,
}: LabelFormProps<R>) {
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
    if (parse(formData.get("name")) === null) {
      fail(invalid);
      return;
    }
    sending.current = true;
    setPending(true);
    const result = await send(formData).catch(() => null);
    sending.current = false;
    setPending(false);
    if (result?.ok) {
      setError(null);
      // The button was disabled meanwhile: the focus stays in the form,
      // unless onDone moves it on.
      input.current?.focus();
      onDone?.(result as Extract<R, { ok: true }>);
      return;
    }
    fail(result?.error ?? failure);
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <label className={styles.label}>
        {label}
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
