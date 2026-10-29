"use client";

import { type FormEvent, useEffect, useRef } from "react";
import { Button } from "@/ui/Button";
import { errorField } from "./messages";
import styles from "./SigninScreen.module.css";
import { SIGNIN_ERROR_ID, SigninTicket } from "./SigninTicket";

interface SignupFormProps {
  /** "invite": the owner code field is the only way in. */
  withCode: boolean;
  error: string | null;
  pending: boolean;
  onSubmit: (formData: FormData) => void;
  onBack: () => void;
}

/**
 * The display name (and owner code), then Face ID creates the account.
 * Submitted by hand rather than through a form action, which would reset the
 * fields: after a cancelled Face ID, the name stays.
 */
export function SignupForm({
  withCode,
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

  const flag = (field: "name" | "ownerCode") =>
    invalid === field
      ? { "aria-invalid": true, "aria-describedby": SIGNIN_ERROR_ID }
      : {};

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
            {...flag("name")}
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
              {...flag("ownerCode")}
            />
          </label>
        )}
      </SigninTicket>
      <div className={styles.actions}>
        <Button
          ref={create}
          type="submit"
          variant="primary"
          className={styles.wide}
          disabled={pending}
        >
          <span>
            CRÉER AVEC <span className={styles.nowrap}>FACE ID</span>
          </span>
        </Button>
        <button
          type="button"
          className={styles.textAction}
          disabled={pending}
          onClick={onBack}
        >
          ← RETOUR
        </button>
      </div>
    </form>
  );
}
