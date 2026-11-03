"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/ui/Button";
import { CLOSED_ERROR } from "./messages";
import { PasskeyActions } from "./PasskeyActions";
import styles from "./SigninScreen.module.css";
import { SigninTicket } from "./SigninTicket";

interface SigninHomeProps {
  /** The ticket's title: « ENTRE DANS WEWATCH », or the inviting group. */
  title: readonly string[];
  /** Whether « CRÉER UN COMPTE » is offered (signup open, or an invite link). */
  canCreate: boolean;
  /** Whether « J’AI UN CODE PROPRIÉTAIRE » is offered (an owner code is set). */
  canUseCode: boolean;
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
 * and, when one is set, the owner code, which joins « NOUS DEUX ».
 */
export function SigninHome({
  title,
  canCreate,
  canUseCode,
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
      <SigninTicket title={title} error={error}>
        {!canCreate && <p className={styles.note}>{CLOSED_ERROR}</p>}
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
        {canCreate && (
          <Button
            variant="secondary"
            className={styles.wide}
            disabled={pending}
            onClick={() => onOpenForm(false)}
          >
            CRÉER UN COMPTE
          </Button>
        )}
        {canUseCode && (
          <button
            type="button"
            className={styles.textAction}
            disabled={pending}
            onClick={() => onOpenForm(true)}
          >
            J’AI UN CODE PROPRIÉTAIRE
          </button>
        )}
      </PasskeyActions>
    </div>
  );
}
