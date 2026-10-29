"use client";

import { Headline } from "@/ui/Headline";
import { SigninHome } from "./SigninHome";
import styles from "./SigninScreen.module.css";
import { SignupForm } from "./SignupForm";
import { type PrepareSignup, useSignin } from "./useSignin";

interface SigninScreenProps {
  signup: "open" | "invite";
  prepareSignup: PrepareSignup;
}

/** The only page without a session: sign in with a passkey, or create an account. */
export function SigninScreen({ signup, prepareSignup }: SigninScreenProps) {
  const signin = useSignin(prepareSignup);
  const { view, error, pending } = signin;
  return (
    <main className={styles.screen}>
      <Headline lines={["CE SOIR", "ON REGARDE"]} className={styles.brand} />
      {view.name === "home" ? (
        <SigninHome
          signup={signup}
          error={error}
          pending={pending}
          returning={view.returning}
          onSignIn={signin.signIn}
          onOpenForm={signin.openForm}
        />
      ) : (
        <SignupForm
          withCode={signup === "invite"}
          error={error}
          pending={pending}
          onSubmit={signin.signUp}
          onBack={signin.back}
        />
      )}
    </main>
  );
}

/** While the session is checked: the title alone, nothing to tap yet. */
export function SigninScreenFallback() {
  return (
    <main className={styles.screen} aria-busy="true">
      <Headline lines={["CE SOIR", "ON REGARDE"]} className={styles.brand} />
    </main>
  );
}
