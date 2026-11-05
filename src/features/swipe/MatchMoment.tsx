"use client";

import { type KeyboardEvent, useEffect, useId, useRef } from "react";
import { Button } from "@/ui/Button";
import { ButtonLink } from "@/ui/ButtonLink";
import { MatchStamp } from "@/ui/MatchStamp";
import styles from "./MatchMoment.module.css";
import { CONTINUE, MATCH_TEXT, MATCH_TITLE, SEE_LIST } from "./messages";

/**
 * « C'EST UN MATCH » printed over the deck once the server said my swipe made
 * the match: a dialog named after its stamp, « CONTINUER ▸ » focused, closed
 * by it or Escape (from inside the dialog only, so another panel's Escape
 * leaves it open). The deck behind it is inert; « ↺ ANNULER » stays above
 * it and undoes the match, but only while the match is the last swipe: an
 * answer that arrives after another card was decided, or once the undo slip
 * has gone, leaves a match that this device can no longer undo.
 */
export function MatchMoment({ onClose }: { onClose: () => void }) {
  const stampId = useId();
  const textId = useId();
  const proceed = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    proceed.current?.focus();
  }, []);
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") onClose();
  };

  return (
    <div className={styles.layer}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={stampId}
        aria-describedby={textId}
        className={styles.moment}
        onKeyDown={onKeyDown}
      >
        <MatchStamp size="large" id={stampId} className={styles.stamp} />
        <div className={styles.side}>
          <div id={textId} className={styles.note}>
            <p className={styles.title}>{MATCH_TITLE}</p>
            <p className={styles.text}>{MATCH_TEXT}</p>
          </div>
          <div className={styles.actions}>
            <ButtonLink href="/list" variant="secondary">
              {SEE_LIST}
            </ButtonLink>
            <Button ref={proceed} variant="love" onClick={onClose}>
              {CONTINUE}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
