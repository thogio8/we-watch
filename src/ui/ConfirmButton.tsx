"use client";

import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Button } from "./Button";
import styles from "./ConfirmButton.module.css";
import { useConfirm } from "./useConfirm";

interface ConfirmTicketProps {
  question: string;
  /** Under the question, e.g. what will be lost. */
  warning?: string;
  confirmLabel: string;
  /** Resolves to a refusal to show (expected, e.g. the last passkey), or nothing once done. */
  action: () => Promise<string | void>;
  failure: string;
  /** Between the question and the answer, e.g. a field to fill in first. */
  children?: ReactNode;
  /** False: the confirm button stays disabled (e.g. until the name is typed). */
  ready?: boolean;
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
  children,
  ready = true,
  leaves,
  onDone,
  onCancel,
}: ConfirmTicketProps) {
  const questionId = useId();
  const warningId = useId();
  const ticket = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const { pending, error, run } = useConfirm(
    async () => (await action()) ?? null,
    { failure, done: onDone, leaves },
  );
  useEffect(() => {
    // Opened low on a phone, the ticket would sit under the fixed nav: brought
    // into view, clear of it (scroll-margin), at once (no motion to reduce).
    cancel.current?.focus({ preventScroll: true });
    ticket.current?.scrollIntoView({ block: "nearest" });
  }, []);
  useEffect(() => {
    // Disabled while it ran, the button lost focus: give it back.
    if (error !== null) confirm.current?.focus();
  }, [error]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && !pending) onCancel();
  };

  return (
    <div
      ref={ticket}
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
      {children}
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
          className={styles.confirm}
          disabled={pending || !ready}
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
  /**
   * Done, and this button goes with what it removed: the focus is moved by
   * this callback instead of coming back to the button.
   */
  onDone?: () => void;
  /** Cancelled (« ANNULER », Escape): e.g. forget what was typed. */
  onCancel?: () => void;
}

/**
 * A destructive action asked twice, in the DA (never window.confirm): the
 * button gives way to a ticket with the question; cancelling brings it back.
 */
export function ConfirmButton({
  label,
  small = false,
  leaves = false,
  onDone,
  onCancel,
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
      onCancel?.();
    };
    const done = () => {
      answered.current = onDone === undefined;
      setAsking(false);
      onDone?.();
    };
    return (
      <ConfirmTicket
        {...ticket}
        leaves={leaves}
        // Leaving: the action navigates away, the ticket stays meanwhile.
        onDone={leaves ? () => {} : done}
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
