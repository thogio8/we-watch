"use client";

import { leaveIfRefused } from "@/access/refusals";
import { useRef, useState } from "react";

/** Resolves to the error to show, or null once done. */
type Confirm = () => Promise<string | null>;

interface ConfirmOptions {
  /** Shown if the action throws, never its raw text. */
  failure: string;
  /** Called once the action succeeded. */
  done: () => void;
  /** The page is leaving: stays pending once done, so nothing runs twice. */
  leaves?: boolean;
}

/**
 * A confirmed action (« REJOINDRE », « RETIRER », « QUITTER »…): runs once
 * however many taps, pending meanwhile; on failure, the error and a retry.
 */
export function useConfirm(
  confirm: Confirm,
  { failure, done, leaves = false }: ConfirmOptions,
) {
  const running = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (running.current) return;
    running.current = true;
    setPending(true);
    setError(null);
    const outcome = await confirm().catch((error: unknown) => {
      leaveIfRefused(error);
      return failure;
    });
    if (outcome === null) {
      done();
      if (leaves) return;
    }
    running.current = false;
    setError(outcome);
    setPending(false);
  };

  return { pending, error, run };
}
