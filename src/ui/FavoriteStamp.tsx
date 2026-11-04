import { FAVORITE_GHOST, FAVORITE_STAMP } from "./favorite";
import styles from "./FavoriteStamp.module.css";
import { Stamp } from "./Stamp";
import { cx } from "./cx";

/** Places a favourite stamp (or the button holding it) on its poster. */
export const posterCorner = styles.corner;

interface FavoriteStampProps {
  on: boolean;
  /** False when its parent is the one placed in the corner (a button). */
  placed?: boolean;
}

/**
 * The big tilted stamp, bottom-left of a poster: « ♥ COUP DE CŒUR » on a
 * favourite, the dashed ghost « ♡ COUP DE CŒUR ? » otherwise. Only the glyph
 * is pink: pink words on paper would miss the contrast.
 */
export function FavoriteStamp({ on, placed = true }: FavoriteStampProps) {
  return (
    <Stamp
      tone={on ? "heart" : "ghost"}
      tilt={-6}
      className={cx(styles.stamp, placed && styles.corner)}
    >
      <span aria-hidden="true" className={cx(on && styles.heart)}>
        {on ? "♥" : "♡"}
      </span>{" "}
      {on ? FAVORITE_STAMP : FAVORITE_GHOST}
    </Stamp>
  );
}
