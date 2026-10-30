"use client";

import { INVITATION_PREFIX } from "@/access/paths";
import { Headline } from "@/ui/Headline";
import { invitedTitle } from "./messages";
import { SigninHome } from "./SigninHome";
import styles from "./SigninScreen.module.css";
import { SignupForm } from "./SignupForm";
import { BRAND_LINES } from "./TicketPage";
import { type PrepareSignup, useSignin } from "./useSignin";

interface SigninScreenProps {
  signup: "open" | "invite";
  prepareSignup: PrepareSignup;
  /** Opened from an invite link: the group is named, an account can be created. */
  invite?: { token: string; groupName: string };
}

/** The only page without a session: sign in with a passkey, or create an account. */
export function SigninScreen({
  signup,
  prepareSignup,
  invite,
}: SigninScreenProps) {
  // Signed in from an invite link: back to it, to join the group.
  const signin = useSignin(
    prepareSignup,
    invite ? `${INVITATION_PREFIX}${invite.token}` : "/",
  );
  const { view, error, pending } = signin;
  return (
    <main className={styles.screen}>
      <Headline lines={BRAND_LINES} className={styles.brand} />
      {view.name === "home" ? (
        <SigninHome
          title={
            invite ? invitedTitle(invite.groupName) : ["ENTRE DANS", "WEWATCH"]
          }
          canCreate={signup === "open" || invite !== undefined}
          error={error}
          pending={pending}
          returning={view.returning}
          onSignIn={signin.signIn}
          onOpenForm={signin.openForm}
        />
      ) : (
        <SignupForm
          withCode={view.withCode}
          invite={invite?.token}
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
      <Headline lines={BRAND_LINES} className={styles.brand} />
    </main>
  );
}
