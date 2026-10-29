"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/ui/Button";
import { PasskeyActions } from "./PasskeyActions";
import styles from "./SigninScreen.module.css";
import { SigninTicket } from "./SigninTicket";

interface SigninHomeProps {
  signup: "open" | "invite";
  error: string | null;
  pending: boolean;
  /** Back from the form: focus returns to the main button. */
  returning: boolean;
  onSignIn: () => void;
  /** `withCode`: the form also asks for the owner code. */
  onOpenForm: (withCode: boolean) => void;
}

/**
 * Passkey sign-in, then a way to create an account (or the invitation note),
 * and in either mode the owner code, which joins « NOUS DEUX ».
 */
export function SigninHome({
  signup,
  error,
  pending,
  returning,
  onSignIn,
  onOpenForm,
}: SigninHomeProps) {
  const signIn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (error !== null) signIn.current?.focus();
  }, [error]);

  return (
    <div className={styles.form}>
      <SigninTicket title={["ENTRE DANS", "WEWATCH"]} error={error}>
        {signup === "invite" && (
          <p className={styles.note}>WEWATCH SE REJOINT SUR INVITATION</p>
        )}
      </SigninTicket>
      <PasskeyActions>
        <Button
          ref={signIn}
          variant="primary"
          className={styles.wide}
          disabled={pending}
          autoFocus={returning}
          onClick={onSignIn}
        >
          SE CONNECTER
        </Button>
        {signup === "open" && (
          <Button
            variant="secondary"
            className={styles.wide}
            disabled={pending}
            onClick={() => onOpenForm(false)}
          >
            CRÉER UN COMPTE
          </Button>
        )}
        <button
          type="button"
          className={styles.textAction}
          disabled={pending}
          onClick={() => onOpenForm(true)}
        >
          J’AI UN CODE PROPRIÉTAIRE
        </button>
      </PasskeyActions>
    </div>
  );
}
