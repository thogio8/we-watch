"use client";

import { useState } from "react";
import { SIGNIN_PATH } from "@/access/paths";
import { Button } from "@/ui/Button";
import styles from "./SignOutButton.module.css";
import { authClient } from "./authClient";

/** Ends the session, then leaves the app for the sign-in page. */
export function SignOutButton() {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signOut() {
    setPending(true);
    setFailed(false);
    try {
      const { error } = await authClient.signOut();
      if (!error) {
        // replace, not assign: Back must not return into the app.
        window.location.replace(SIGNIN_PATH);
        return;
      }
    } catch {
      // Same outcome as an error answer: nothing raw shown, retry allowed.
    }
    setFailed(true);
    setPending(false);
  }

  return (
    <div className={styles.signOut}>
      <Button variant="secondary" disabled={pending} onClick={signOut}>
        SE DÉCONNECTER
      </Button>
      {failed && (
        <p className={styles.failed} role="alert">
          DÉCONNEXION IMPOSSIBLE, RÉESSAIE
        </p>
      )}
    </div>
  );
}
