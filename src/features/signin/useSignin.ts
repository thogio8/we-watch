"use client";

import { useState } from "react";
import { isTooManyAttempts, TOO_MANY_ATTEMPTS } from "@/domain/rate-limit";
import type { PrepareSignupResult } from "./actions";
import { authClient } from "./authClient";
import { CANCELLED_ERROR, signinFailure } from "./messages";

export type PrepareSignup = (
  formData: FormData,
) => Promise<PrepareSignupResult>;

/**
 * The home (`returning`: back from the form, focus goes back to it) or the
 * form (`withCode`: with the owner code field).
 */
export type SigninView =
  { name: "home"; returning: boolean } | { name: "form"; withCode: boolean };

/** A ceremony resolves to the error to show, or null once signed in. */
type Ceremony = () => Promise<string | null>;

/** Passkey sign-in: the device picks one of its passkeys for this site. */
async function signInWithPasskey(): Promise<string | null> {
  const { error } = await authClient.signIn.passkey();
  return error ? signinFailure(error) : null;
}

/** Ticket first (name, signup right), then the passkey that creates the account. */
async function signUpWithPasskey(
  prepareSignup: PrepareSignup,
  formData: FormData,
): Promise<string | null> {
  const prepared = await prepareSignup(formData);
  if (!prepared.ok) {
    return prepared.error;
  }
  const { error } = await authClient.passkey.addPasskey({
    context: prepared.ticket,
    // The server forces it too: user, passkey and session in one transaction.
    createSession: true,
    name: "WeWatch",
  });
  if (!error) {
    return null;
  }
  return isTooManyAttempts(error) ? TOO_MANY_ATTEMPTS : CANCELLED_ERROR;
}

/**
 * The sign-in screen's state: which view, the error shown, the ceremonies.
 * `signedInPath`: where a sign-in leads (an invite link returns to itself); a
 * new account always goes to the app, its invitation already joined.
 */
export function useSignin(prepareSignup: PrepareSignup, signedInPath = "/") {
  const [view, setView] = useState<SigninView>({
    name: "home",
    returning: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const run = async (ceremony: Ceremony, destination: string) => {
    setPending(true);
    setError(null);
    // The client may also throw (network, WebAuthn): never show raw text.
    const failure = await ceremony().catch(() => CANCELLED_ERROR);
    if (failure === null) {
      // A full load, so no page kept in the client cache (staleTimes) shows
      // the signed-out state; replace, so Back does not return here. Stays
      // pending while the app loads.
      window.location.replace(destination);
      return;
    }
    setError(failure);
    setPending(false);
  };

  const show = (next: SigninView) => {
    setError(null);
    setView(next);
  };

  return {
    view,
    error,
    pending,
    signIn: () => run(signInWithPasskey, signedInPath),
    signUp: (formData: FormData) =>
      run(() => signUpWithPasskey(prepareSignup, formData), "/"),
    openForm: (withCode: boolean) => show({ name: "form", withCode }),
    back: () => show({ name: "home", returning: true }),
  };
}
