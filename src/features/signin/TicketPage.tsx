import type { ReactNode } from "react";
import { Headline } from "@/ui/Headline";
import styles from "./SigninScreen.module.css";
import { SigninTicket } from "./SigninTicket";

export const BRAND_LINES = ["CE SOIR", "ON REGARDE"] as const;

interface TicketPageProps {
  title: readonly string[];
  error: string | null;
  /** Under the ticket: what to do next. */
  children: ReactNode;
}

/**
 * A page outside the app, like the sign-in: the brand, the pink ticket with
 * its title (and the error on its stub), then the buttons.
 */
export function TicketPage({ title, error, children }: TicketPageProps) {
  return (
    <main className={styles.screen} data-public-screen>
      <Headline lines={BRAND_LINES} className={styles.brand} />
      <div className={styles.form}>
        <SigninTicket title={title} error={error} />
        <div className={styles.actions}>{children}</div>
      </div>
    </main>
  );
}
