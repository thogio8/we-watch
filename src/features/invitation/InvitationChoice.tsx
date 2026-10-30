"use client";

import { useEffect, useRef } from "react";
import { TicketPage } from "@/features/signin/TicketPage";
import { Button } from "@/ui/Button";
import styles from "./InvitationScreen.module.css";
import { useConfirm } from "./useConfirm";

interface InvitationChoiceProps {
  title: readonly string[];
  label: string;
  /** Resolves to the error to show, or null once done. */
  confirm: () => Promise<string | null>;
  /** Shown when `confirm` throws. */
  failure: string;
}

/** Signed in: the group named on the ticket, and one button to go in. */
export function InvitationChoice({
  title,
  label,
  confirm,
  failure,
}: InvitationChoiceProps) {
  const { pending, error, run } = useConfirm(confirm, failure);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // Disabled while it ran, the button lost focus: give it back.
    if (error !== null) button.current?.focus();
  }, [error]);

  return (
    <TicketPage title={title} error={error}>
      <Button
        ref={button}
        variant="primary"
        className={styles.wide}
        disabled={pending}
        onClick={run}
      >
        {label}
      </Button>
    </TicketPage>
  );
}
