import type { Movie } from "@/domain/movie";
import { TornPile } from "@/ui/TornPile";
import styles from "./DrawScreen.module.css";

export interface DrawPileProps {
  count: number;
  /** The last torn movie that still suits tonight, if any. */
  lastTorn: Movie | null;
  onUntear: () => void;
}

/** « PAS CE SOIR » pile, with a way to take its last ticket back. */
export function DrawPile({ count, lastTorn, onUntear }: DrawPileProps) {
  return (
    <>
      <TornPile count={count} label="PAS CE SOIR" />
      {lastTorn && (
        <button type="button" className={styles.untear} onClick={onUntear}>
          ↺ RESSORTIR {lastTorn.title}
        </button>
      )}
    </>
  );
}
