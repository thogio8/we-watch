"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { leaveIfRefused } from "@/access/refusals";
import { isStaleSession } from "@/domain/recent-sign-in";
import { authClient } from "@/features/signin/authClient";
import { CANCELLED_ERROR } from "@/features/signin/messages";
import { PasskeyActions } from "@/features/signin/PasskeyActions";
import { Button } from "@/ui/Button";
import styles from "./Account.module.css";
import { addPasskeyFailure, PASSKEY_ADDED } from "./messages";
import {
  type Confirmed,
  confirmThenReplay,
  type Reconfirm,
} from "./recent-sign-in";

interface AddPasskeyProps {
  /** Told once the key is added, before the list is reloaded. */
  onAdded: () => void;
  /** An old session asks the device lock again (confirmThenReplay). */
  reconfirm: Reconfirm;
}

type Added = Awaited<ReturnType<typeof authClient.passkey.addPasskey>> | null;

/**
 * The server names it after this device: no name is sent. Refused for an
 * old session (403 SESSION_NOT_FRESH), it is asked again after the device
 * lock. Its failure, or revokeSession's, reads as a cancellation.
 */
function addWithRecentSession(reconfirm: Reconfirm): Promise<Confirmed<Added>> {
  return confirmThenReplay(
    () => authClient.passkey.addPasskey().catch((): Added => null),
    (result) => isStaleSession(result?.error),
    reconfirm,
  ).catch((error: unknown) => {
    leaveIfRefused(error);
    return { done: false, error: CANCELLED_ERROR };
  });
}

/**
 * « AJOUTER UNE CLÉ D’ACCÈS »: this device's lock makes one more passkey for
 * my account (over HTTP, not a Server Action), then the list is reloaded.
 */
export function AddPasskey({ onAdded, reconfirm }: AddPasskeyProps) {
  const router = useRouter();
  const adding = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  async function add() {
    if (adding.current) return;
    adding.current = true;
    setPending(true);
    setError(null);
    setStatus("");
    const confirmed = await addWithRecentSession(reconfirm);
    adding.current = false;
    setPending(false);
    if (!confirmed.done) {
      setError(confirmed.error);
      return;
    }
    const result = confirmed.outcome;
    if (result !== null && result.error === null) {
      setStatus(PASSKEY_ADDED);
      onAdded();
      router.refresh();
      return;
    }
    setError(addPasskeyFailure(result?.error ?? null));
  }

  return (
    <PasskeyActions>
      <Button variant="primary" disabled={pending} onClick={add}>
        AJOUTER UNE CLÉ D’ACCÈS
      </Button>
      <p className={styles.status} role="status">
        {status}
      </p>
      {error !== null && (
        <p className={styles.alert} role="alert">
          {error}
        </p>
      )}
    </PasskeyActions>
  );
}
