import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getServerEnv } from "@/env";
import { APP_NAME } from "@/features/pwa/brand";
import { prepareSignup } from "@/features/signin/actions";
import {
  SigninScreen,
  SigninScreenFallback,
} from "@/features/signin/SigninScreen";
import { getCurrentUser } from "@/server/session";

export const metadata: Metadata = { title: `Entrer · ${APP_NAME}` };

/**
 * Per request (it reads the session headers): a signed-in visitor goes to the
 * app, and SIGNUP is read at run time, never baked into the static shell.
 */
async function Signin() {
  if ((await getCurrentUser()) !== null) {
    redirect("/");
  }
  const { SIGNUP } = getServerEnv();
  return <SigninScreen signup={SIGNUP} prepareSignup={prepareSignup} />;
}

export default function SigninPage() {
  return (
    <Suspense fallback={<SigninScreenFallback />}>
      <Signin />
    </Suspense>
  );
}
