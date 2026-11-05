import styles from "./MatchStamp.module.css";
import { cx } from "./cx";

interface MatchStampProps {
  /** small: « ♥♥ MATCH » on a poster; large: the match moment's stamp. */
  size: "small" | "large";
  /** E.g. to name a dialog after the stamp. */
  id?: string;
  className?: string;
}

/** Pink then blue, offset like a riso misprint; read out as « MATCH ». */
function Hearts() {
  return (
    <span aria-hidden="true" className={styles.hearts}>
      <span className={styles.pink}>♥</span>
      <span className={styles.blue}>♥</span>
    </span>
  );
}

/**
 * A yellow stamp for a movie the whole group wants. The words stay in ink
 * (pink on yellow would miss the contrast); the hearts are decoration.
 */
export function MatchStamp({ size, id, className }: MatchStampProps) {
  if (size === "small") {
    return (
      <span id={id} className={cx(styles.stamp, styles.small, className)}>
        <Hearts /> MATCH
      </span>
    );
  }
  return (
    <span id={id} className={cx(styles.stamp, styles.large, className)}>
      <span className={styles.frame}>
        <span className={styles.lead}>C’EST UN</span>{" "}
        <span className={styles.word}>MATCH</span> <Hearts />
      </span>
    </span>
  );
}
