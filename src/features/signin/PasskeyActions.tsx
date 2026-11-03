"use client";

import type { ReactNode } from "react";
import styles from "./SigninScreen.module.css";
import { usePasskeysSupported } from "./usePasskeysSupported";

const PASSKEY_HINT = "Face ID, empreinte ou code de ton téléphone";
const UNSUPPORTED_MESSAGE =
  "CE NAVIGATEUR NE GÈRE PAS LES CLÉS D’ACCÈS. METS-LE À JOUR OU ESSAIE UN AUTRE APPAREIL.";

interface PasskeyActionsProps {
  /** The buttons that open the device lock. */
  children: ReactNode;
  /** Shown either way, below (« ← RETOUR »). */
  after?: ReactNode;
}

/**
 * Under the ticket: what unlocks the account, then the passkey buttons. A
 * browser without passkeys gets an explanation instead, nothing to tap.
 */
export function PasskeyActions({ children, after }: PasskeyActionsProps) {
  const supported = usePasskeysSupported();
  return (
    <>
      {supported && <p className={styles.hint}>{PASSKEY_HINT}</p>}
      <div className={styles.actions}>
        {supported ? (
          children
        ) : (
          <p className={styles.unsupported} role="alert">
            {UNSUPPORTED_MESSAGE}
          </p>
        )}
        {after}
      </div>
    </>
  );
}
