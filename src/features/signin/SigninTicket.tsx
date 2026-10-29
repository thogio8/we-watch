import type { ReactNode } from "react";
import { Lines } from "@/ui/Lines";
import { Ticket } from "@/ui/Ticket";
import styles from "./SigninScreen.module.css";

/** Shorter when the phone is held sideways (spec §12). */
const POSTER_HEIGHT = "clamp(80px, calc(100dvh - 330px), 150px)";

export const SIGNIN_ERROR_ID = "signin-error";

interface SigninTicketProps {
  title: readonly string[];
  error: string | null;
  children?: ReactNode;
}

/** The pink ticket of both views: its title, then the stub with the error. */
export function SigninTicket({ title, error, children }: SigninTicketProps) {
  return (
    <Ticket
      className={styles.ticket}
      posterHeight={POSTER_HEIGHT}
      poster={
        <div className={styles.head}>
          <h2 className={styles.title}>
            <Lines lines={title} />
          </h2>
        </div>
      }
    >
      {children}
      {/* Always rendered so the ticket keeps its height and the alert is heard. */}
      <p id={SIGNIN_ERROR_ID} className={styles.error} role="alert">
        {error}
      </p>
    </Ticket>
  );
}
