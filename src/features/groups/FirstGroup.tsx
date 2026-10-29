import { SignOutButton } from "@/features/signin/SignOutButton";
import { Headline } from "@/ui/Headline";

/**
 * No group yet: where the first one gets created (screen to come, Task 6).
 * Signing out stays possible, as LISTE (its usual place) is not shown.
 */
export function FirstGroup() {
  return (
    <main>
      <Headline lines={["CRÉER TON PREMIER GROUPE"]} size="medium" />
      <SignOutButton />
    </main>
  );
}
