"use client";

import { SignOutButton } from "@/features/signin/SignOutButton";
import { Headline } from "@/ui/Headline";
import sheet from "@/ui/Sheet.module.css";
import styles from "./Account.module.css";
import type { AccountResult, MyPasskey, MySession } from "./actions";
import { DeleteAccount } from "./DeleteAccount";
import { DeviceList } from "./DeviceList";
import { NameForm } from "./NameForm";
import { PasskeyList } from "./PasskeyList";

/** The actions of features/account, passed by the page. */
interface AccountActions {
  rename: (formData: FormData) => Promise<AccountResult>;
  removePasskey: (id: string) => Promise<AccountResult>;
  revokeSession: (id: string) => Promise<boolean>;
  deleteAccount: (formData: FormData) => Promise<AccountResult>;
}

interface AccountScreenProps {
  /** My name. */
  name: string;
  passkeys: MyPasskey[];
  sessions: MySession[];
  actions: AccountActions;
}

const TITLE = ["MON COMPTE"] as const;

/**
 * « MON COMPTE »: my name, my passkeys, my devices, signing out, deleting
 * the account. No group pill: nothing here belongs to a group.
 */
export function AccountScreen({
  name,
  passkeys,
  sessions,
  actions,
}: AccountScreenProps) {
  return (
    <main className={sheet.screen}>
      <Headline lines={TITLE} size="medium" />
      <div className={sheet.sheet}>
        <NameForm name={name} rename={actions.rename} />
      </div>
      <PasskeyList passkeys={passkeys} remove={actions.removePasskey} />
      <DeviceList sessions={sessions} revoke={actions.revokeSession} />
      <div className={styles.end}>
        <SignOutButton />
        <DeleteAccount name={name} remove={actions.deleteAccount} />
      </div>
    </main>
  );
}

/** Shown while the account loads: the title alone. */
export function AccountScreenFallback() {
  return (
    <main className={sheet.screen} aria-busy="true">
      <Headline lines={TITLE} size="medium" />
    </main>
  );
}
