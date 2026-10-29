"use client";

import { SignOutButton } from "@/features/signin/SignOutButton";
import { Headline } from "@/ui/Headline";
import type { CreateGroupResult } from "./actions";
import { CreateGroupForm } from "./CreateGroupForm";
import styles from "./FirstGroupScreen.module.css";
import { withPillFocus } from "./pillFocus";

interface FirstGroupScreenProps {
  create: (formData: FormData) => Promise<CreateGroupResult>;
}

/**
 * No group yet: the first one is created here. Signing out stays possible,
 * as the pill's panel (its usual place) needs a group to show.
 */
export function FirstGroupScreen({ create }: FirstGroupScreenProps) {
  return (
    <main className={styles.screen}>
      <Headline lines={["CRÉER TON", "PREMIER GROUPE"]} size="medium" />
      <section className={styles.sheet} aria-label="Nouveau groupe">
        {/* The action sets the cookie and revalidates: its response brings
            the page of the new group, pill included, in place of this one. */}
        <CreateGroupForm create={withPillFocus(create)} />
      </section>
      <div className={styles.signOut}>
        <SignOutButton />
      </div>
    </main>
  );
}
