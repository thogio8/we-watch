"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { authClient } from "@/features/signin/authClient";
import { PasskeyActions } from "@/features/signin/PasskeyActions";
import { Button } from "@/ui/Button";
import styles from "./Account.module.css";
import { addPasskeyFailure, PASSKEY_ADDED } from "./messages";

interface AddPasskeyProps {
  /** Told once the key is added, before the list is reloaded. */
  onAdded: () => void;
}

/**
 * « AJOUTER UNE CLÉ D’ACCÈS »: this device's lock makes one more passkey for
 * my account (over HTTP, not a Server Action), then the list is reloaded.
 */
export function AddPasskey({ onAdded }: AddPasskeyProps) {
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
    // The server names it after this device: no name is sent.
    const result = await authClient.passkey.addPasskey().catch(() => null);
    adding.current = false;
    setPending(false);
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
