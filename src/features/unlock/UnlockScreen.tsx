"use client";

import { useActionState } from "react";
import { Button } from "@/ui/Button";
import { Lines } from "@/ui/Lines";
import { Ticket } from "@/ui/Ticket";
import { unlock } from "./actions";
import { INITIAL_UNLOCK_STATE } from "./state";
import styles from "./UnlockScreen.module.css";

/** Shorter when the phone is held sideways (spec §12). */
const POSTER_HEIGHT = "clamp(80px, calc(100dvh - 300px), 150px)";

/** Shared access code form. React resets the field after each attempt. */
export function UnlockScreen() {
  const [state, formAction, pending] = useActionState(
    unlock,
    INITIAL_UNLOCK_STATE,
  );
  return (
    <main className={styles.screen}>
      <h1 className={styles.logo}>
        <Lines lines={["CE SOIR", "ON REGARDE"]} />
      </h1>
      <form action={formAction} className={styles.form}>
        <Ticket
          className={styles.ticket}
          posterHeight={POSTER_HEIGHT}
          poster={
            <div className={styles.head}>
              <h2 className={styles.title}>
                <Lines lines={["ENTREZ", "LE CODE"]} />
              </h2>
            </div>
          }
        >
          <input
            className={styles.input}
            type="password"
            name="code"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Code d'accès"
            aria-describedby={state.error ? "unlock-error" : undefined}
            aria-invalid={state.error ? true : undefined}
            required
          />
          <p id="unlock-error" className={styles.error} role="alert">
            {state.error}
          </p>
        </Ticket>
        <Button
          type="submit"
          variant="primary"
          disabled={pending}
          className={styles.enter}
        >
          ENTRER
        </Button>
      </form>
    </main>
  );
}
