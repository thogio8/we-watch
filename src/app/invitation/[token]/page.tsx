import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { getServerEnv } from "@/env";
import { chooseGroup, joinGroup } from "@/features/groups/actions";
import { InvitationScreen } from "@/features/invitation/InvitationScreen";
import { loadInvitation } from "@/features/invitation/load";
import { APP_NAME } from "@/features/pwa/brand";
import { prepareSignup } from "@/features/signin/actions";
import { SigninScreenFallback } from "@/features/signin/SigninScreen";

export const metadata: Metadata = { title: `Invitation · ${APP_NAME}` };

/** Per request: who opens the link (session) decides what it shows. */
async function Invitation({
  params,
}: Pick<PageProps<"/invitation/[token]">, "params">) {
  await connection();
  const { token } = await params;
  const invitation = await loadInvitation(token);
  return (
    <InvitationScreen
      invitation={invitation}
      token={token}
      signup={getServerEnv().SIGNUP}
      actions={{
        join: joinGroup.bind(null, token),
        choose: chooseGroup,
        prepareSignup,
      }}
    />
  );
}

export default function InvitationPage({
  params,
}: PageProps<"/invitation/[token]">) {
  return (
    <Suspense fallback={<SigninScreenFallback />}>
      <Invitation params={params} />
    </Suspense>
  );
}
