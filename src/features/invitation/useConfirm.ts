"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

/** Resolves to the error to show, or null once done. */
type Confirm = () => Promise<string | null>;

/**
 * « REJOINDRE » / « Y ALLER »: runs once however many taps, then leads to
 * the app (replace, so Back does not return to the link); `failure` is shown
 * if the action throws, never its raw text.
 */
export function useConfirm(confirm: Confirm, failure: string) {
  const router = useRouter();
  const running = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (running.current) return;
    running.current = true;
    setPending(true);
    setError(null);
    const outcome = await confirm().catch(() => failure);
    if (outcome === null) {
      // Stays pending while the app loads.
      router.replace("/");
      return;
    }
    running.current = false;
    setError(outcome);
    setPending(false);
  };

  return { pending, error, run };
}
