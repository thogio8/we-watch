"use client";

import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { Button } from "./Button";
import styles from "./ConfirmButton.module.css";
import { useConfirm } from "./useConfirm";

interface ConfirmTicketProps {
  question: string;
  /** Under the question, e.g. what will be lost. */
  warning?: string;
  confirmLabel: string;
  action: () => Promise<void>;
  failure: string;
  /** The page is leaving once done: the ticket stays, pending. */
  leaves: boolean;
  onDone: () => void;
  onCancel: () => void;
}

/** The question on a pink ticket stub, « ANNULER » first (and focused). */
function ConfirmTicket({
  question,
  warning,
  confirmLabel,
  action,
  failure,
  leaves,
  onDone,
  onCancel,
}: ConfirmTicketProps) {
  const questionId = useId();
  const warningId = useId();
  const cancel = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const { pending, error, run } = useConfirm(
    async () => {
      await action();
      return null;
    },
    { failure, done: onDone, leaves },
  );
  useEffect(() => cancel.current?.focus(), []);
  useEffect(() => {
    // Disabled while it ran, the button lost focus: give it back.
    if (error !== null) confirm.current?.focus();
  }, [error]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && !pending) onCancel();
  };

  return (
    <div
      role="group"
      aria-labelledby={questionId}
      aria-describedby={warning ? warningId : undefined}
      className={styles.ticket}
      onKeyDown={onKeyDown}
    >
      <p id={questionId} className={styles.question}>
        {question}
      </p>
      {warning && (
        <p id={warningId} className={styles.warning}>
          {warning}
        </p>
      )}
      {error !== null && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.buttons}>
        <Button
          ref={cancel}
          variant="secondary"
          disabled={pending}
          onClick={onCancel}
        >
          ANNULER
        </Button>
        <Button
          ref={confirm}
          variant="primary"
          disabled={pending}
          onClick={run}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}

interface ConfirmButtonProps extends Omit<
  ConfirmTicketProps,
  "leaves" | "onDone" | "onCancel"
> {
  /** The button that asks. */
  label: string;
  /** « RETIRER » in a row: a small chip rather than a full button. */
  small?: boolean;
  leaves?: boolean;
}

/**
 * A destructive action asked twice, in the DA (never window.confirm): the
 * button gives way to a ticket with the question; cancelling brings it back.
 */
export function ConfirmButton({
  label,
  small = false,
  leaves = false,
  ...ticket
}: ConfirmButtonProps) {
  const [asking, setAsking] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const answered = useRef(false);
  useEffect(() => {
    // Back from the ticket: the focus returns to the button.
    if (!asking && answered.current) trigger.current?.focus();
  }, [asking]);

  if (asking) {
    const close = () => {
      answered.current = true;
      setAsking(false);
    };
    return (
      <ConfirmTicket
        {...ticket}
        leaves={leaves}
        // Leaving: the action navigates away, the ticket stays meanwhile.
        onDone={leaves ? () => {} : close}
        onCancel={close}
      />
    );
  }
  return small ? (
    <button
      ref={trigger}
      type="button"
      className={styles.chip}
      onClick={() => setAsking(true)}
    >
      {label}
    </button>
  ) : (
    <Button ref={trigger} variant="secondary" onClick={() => setAsking(true)}>
      {label}
    </Button>
  );
}
