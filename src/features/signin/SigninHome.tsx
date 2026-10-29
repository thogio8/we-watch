"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/ui/Button";
import styles from "./SigninScreen.module.css";
import { SigninTicket } from "./SigninTicket";

interface SigninHomeProps {
  signup: "open" | "invite";
  error: string | null;
  pending: boolean;
  /** Back from the form: focus returns to the main button. */
  returning: boolean;
  onSignIn: () => void;
  onOpenForm: () => void;
}

/** Face ID sign-in, then a way to create an account (or the invitation note). */
export function SigninHome({
  signup,
  error,
  pending,
  returning,
  onSignIn,
  onOpenForm,
}: SigninHomeProps) {
  const faceId = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (error !== null) faceId.current?.focus();
  }, [error]);

  return (
    <div className={styles.form}>
      <SigninTicket title={["ENTRE DANS", "WEWATCH"]} error={error}>
        {signup === "invite" && (
          <p className={styles.note}>WEWATCH SE REJOINT SUR INVITATION</p>
        )}
      </SigninTicket>
      <div className={styles.actions}>
        <Button
          ref={faceId}
          variant="primary"
          className={styles.wide}
          disabled={pending}
          autoFocus={returning}
          onClick={onSignIn}
        >
          {/* One flex item, so the label wraps as text, before « FACE ID ». */}
          <span>
            SE CONNECTER AVEC <span className={styles.nowrap}>FACE ID</span>
          </span>
        </Button>
        {signup === "open" ? (
          <Button
            variant="secondary"
            className={styles.wide}
            disabled={pending}
            onClick={onOpenForm}
          >
            CRÉER UN COMPTE
          </Button>
        ) : (
          <button
            type="button"
            className={styles.textAction}
            disabled={pending}
            onClick={onOpenForm}
          >
            J’AI UN CODE PROPRIÉTAIRE
          </button>
        )}
      </div>
    </div>
  );
}
