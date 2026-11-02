import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { SIGNIN_PATH } from "@/access/paths";
import {
  deleteAccount,
  deletePasskey,
  renameMe,
  revokeSession,
} from "@/features/account/actions";
import {
  AccountScreen,
  AccountScreenFallback,
} from "@/features/account/AccountScreen";
import { listMyPasskeys, listMySessions } from "@/features/account/load";
import { APP_NAME } from "@/features/pwa/brand";
import { getCurrentUser } from "@/server/session";

export const metadata: Metadata = { title: `Mon compte · ${APP_NAME}` };

/**
 * My account, per request, for the session read once here. Signed out (a session revoked since the proxy
 * let the request through): the sign-in page.
 */
async function AccountData() {
  await connection();
  const user = await getCurrentUser();
  if (user === null) {
    redirect(SIGNIN_PATH);
  }
  const [passkeys, sessions] = await Promise.all([
    listMyPasskeys(user.userId),
    listMySessions(user.userId, user.sessionId),
  ]);
  return (
    <AccountScreen
      name={user.name}
      passkeys={passkeys}
      sessions={sessions}
      actions={{
        rename: renameMe,
        removePasskey: deletePasskey,
        revokeSession,
        deleteAccount,
      }}
    />
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<AccountScreenFallback />}>
      <AccountData />
    </Suspense>
  );
}
