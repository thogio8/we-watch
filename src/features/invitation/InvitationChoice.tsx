"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";
import { TicketPage } from "@/features/signin/TicketPage";
import { Button } from "@/ui/Button";
import { useConfirm } from "@/ui/useConfirm";
import styles from "./InvitationScreen.module.css";

interface InvitationChoiceProps {
  title: readonly string[];
  label: string;
  /** Resolves to the error to show, or null once done. */
  confirm: () => Promise<string | null>;
  /** Shown when `confirm` throws. */
  failure: string;
  /** Under the button: a way out. */
  children?: ReactNode;
}

/** Signed in: the group named on the ticket, and one button to go in. */
export function InvitationChoice({
  title,
  label,
  confirm,
  failure,
  children,
}: InvitationChoiceProps) {
  const router = useRouter();
  // Leads to the app (replace, so Back does not return to the link), and
  // stays pending while it loads.
  const { pending, error, run } = useConfirm(confirm, {
    failure,
    done: () => router.replace("/"),
    leaves: true,
  });
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
      {children}
    </TicketPage>
  );
}
