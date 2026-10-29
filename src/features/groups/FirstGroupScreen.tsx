"use client";

import { useRouter } from "next/navigation";
import { SignOutButton } from "@/features/signin/SignOutButton";
import { Headline } from "@/ui/Headline";
import type { CreateGroupResult } from "./actions";
import { CreateGroupForm } from "./CreateGroupForm";
import styles from "./FirstGroupScreen.module.css";

interface FirstGroupScreenProps {
  create: (formData: FormData) => Promise<CreateGroupResult>;
}

/**
 * No group yet: the first one is created here. Signing out stays possible,
 * as the pill's panel (its usual place) needs a group to show.
 */
export function FirstGroupScreen({ create }: FirstGroupScreenProps) {
  const router = useRouter();
  return (
    <main className={styles.screen}>
      <Headline lines={["CRÉER TON", "PREMIER GROUPE"]} size="medium" />
      <section className={styles.sheet} aria-label="Nouveau groupe">
        {/* The actions revalidate the pages; refresh shows the new group now. */}
        <CreateGroupForm create={create} onCreated={() => router.refresh()} />
      </section>
      <div className={styles.signOut}>
        <SignOutButton />
      </div>
    </main>
  );
}
