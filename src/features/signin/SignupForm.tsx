"use client";

import { type FormEvent, useEffect, useRef } from "react";
import { Button } from "@/ui/Button";
import { errorField } from "./messages";
import { PasskeyActions } from "./PasskeyActions";
import styles from "./SigninScreen.module.css";
import { SIGNIN_ERROR_ID, SigninTicket } from "./SigninTicket";

interface SignupFormProps {
  /** The owner code field: the only way in on invitation, optional when open. */
  withCode: boolean;
  /** The token of the invite link the form came from, sent along. */
  invite?: string;
  error: string | null;
  pending: boolean;
  onSubmit: (formData: FormData) => void;
  onBack: () => void;
}

type Field = "name" | "ownerCode";

/** The field at fault is flagged invalid and points to the error. */
function flag(invalid: Field | null, field: Field) {
  return invalid === field
    ? { "aria-invalid": true, "aria-describedby": SIGNIN_ERROR_ID }
    : {};
}

/**
 * The display name (and owner code), then the device lock creates the
 * account's passkey. Submitted by hand rather than through a form action,
 * which would reset the fields: after a cancelled validation, the name stays.
 */
export function SignupForm({
  withCode,
  invite,
  error,
  pending,
  onSubmit,
  onBack,
}: SignupFormProps) {
  const name = useRef<HTMLInputElement>(null);
  const ownerCode = useRef<HTMLInputElement>(null);
  const create = useRef<HTMLButtonElement>(null);
  const invalid = errorField(error);

  useEffect(() => {
    if (error === null) return;
    // The field at fault, else the button (no code field: the button too).
    const target = invalid === null ? create : { name, ownerCode }[invalid];
    (target.current ?? create.current)?.focus();
  }, [error, invalid]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget));
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <SigninTicket title={["CRÉER", "UN COMPTE"]} error={error}>
        <label className={styles.label}>
          TON PRÉNOM OU SURNOM
          <input
            ref={name}
            className={styles.input}
            name="name"
            autoComplete="nickname"
            autoFocus
            {...flag(invalid, "name")}
          />
        </label>
        {withCode && (
          <label className={styles.label}>
            CODE PROPRIÉTAIRE
            <input
              ref={ownerCode}
              className={styles.input}
              type="password"
              name="ownerCode"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              {...flag(invalid, "ownerCode")}
            />
          </label>
        )}
        {/* Last, so the name label stays the ticket's first child. */}
        {invite && <input type="hidden" name="invite" value={invite} />}
      </SigninTicket>
      <PasskeyActions
        after={
          <button
            type="button"
            className={styles.textAction}
            disabled={pending}
            onClick={onBack}
          >
            ← RETOUR
          </button>
        }
      >
        <Button
          ref={create}
          type="submit"
          variant="primary"
          className={styles.wide}
          disabled={pending}
        >
          CRÉER MON COMPTE
        </Button>
      </PasskeyActions>
    </form>
  );
}
