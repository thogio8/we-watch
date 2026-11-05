"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/ui/Button";
import { ButtonLink } from "@/ui/ButtonLink";
import { MatchStamp } from "@/ui/MatchStamp";
import styles from "./MatchMoment.module.css";
import { CONTINUE, MATCH_TEXT, MATCH_TITLE, SEE_LIST } from "./messages";

/**
 * « C'EST UN MATCH » printed over the deck once the server said my swipe made
 * the match: a dialog named after its stamp, « CONTINUER ▸ » focused, closed
 * by it or Escape. « ↺ ANNULER » stays above it (it undoes the match).
 */
export function MatchMoment({ onClose }: { onClose: () => void }) {
  const stampId = useId();
  const textId = useId();
  const proceed = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    proceed.current?.focus();
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={styles.layer}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={stampId}
        aria-describedby={textId}
        className={styles.moment}
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
