"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { authClient } from "@/features/signin/authClient";
import { CANCELLED_ERROR } from "@/features/signin/messages";
import { PasskeyActions } from "@/features/signin/PasskeyActions";
import { Button } from "@/ui/Button";
import styles from "./Account.module.css";

/**
 * « AJOUTER UNE CLÉ D’ACCÈS »: this device's lock makes one more passkey for
 * my account (over HTTP, not a Server Action), then the list is reloaded.
 */
export function AddPasskey() {
  const router = useRouter();
  const adding = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (adding.current) return;
    adding.current = true;
    setPending(true);
    setError(null);
    // The server names it after this device: no name is sent.
    const result = await authClient.passkey.addPasskey().catch(() => null);
    adding.current = false;
    setPending(false);
    if (result?.error === null) {
      router.refresh();
      return;
    }
    setError(CANCELLED_ERROR);
  }

  return (
    <PasskeyActions>
      <Button variant="primary" disabled={pending} onClick={add}>
        AJOUTER UNE CLÉ D’ACCÈS
      </Button>
      {error !== null && (
        <p className={styles.alert} role="alert">
          {error}
        </p>
      )}
    </PasskeyActions>
  );
}
