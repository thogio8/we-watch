"use client";

import type { ListCounts } from "@/domain/movie";
import type { Platform, TonightFilters } from "@/domain/tonight";
import { formatClock } from "@/domain/time";
import { Button } from "@/ui/Button";
import { cx } from "@/ui/cx";
import { Headline } from "@/ui/Headline";
import { Lines } from "@/ui/Lines";
import styles from "./DrawScreen.module.css";
import { drawButton, homeCounts } from "./drawView";
import { TonightPanel } from "./TonightPanel";

interface DrawHomeProps {
  /** Whether the « à voir » list has movies: no panel to fill otherwise. */
  hasList: boolean;
  counts: ListCounts;
  filters: TonightFilters;
  platforms: readonly Platform[];
  favoriteCount: number;
  matchCount: number;
  onFiltersChange: (filters: TonightFilters) => void;
  filtering: boolean;
  eligibleCount: number;
  now: Date | null;
  onDraw: () => void;
  onClearFilters: () => void;
}

/** The home of the draw: title, tonight's filters and the big button. */
export function DrawHome(props: DrawHomeProps) {
  const { hasList, counts, filters, platforms, onFiltersChange, now } = props;
  return (
    // Wide column: title on top, the panel and the button side by side.
    <div className={cx(styles.home, hasList && styles.split)}>
      <div className={styles.head}>
        <Headline lines={["CE SOIR", "ON REGARDE"]} className={styles.brand} />
        <p className={cx(styles.small, styles.counts)}>{homeCounts(counts)}</p>
      </div>
      {hasList && (
        <div className={styles.side}>
          <TonightPanel
            filters={filters}
            platforms={platforms}
            favoriteCount={props.favoriteCount}
            matchCount={props.matchCount}
            onChange={onFiltersChange}
          />
        </div>
      )}
      <div className={styles.main}>
        <DrawAction {...props} />
        <p className={cx(styles.small, styles.clock)}>
          {now === null ? " " : `Il est ${formatClock(now)}`}
        </p>
      </div>
    </div>
  );
}

/** TIRER, or a way out when the filters leave no movie. */
function DrawAction({
  hasList,
  filters,
  filtering,
  eligibleCount,
  onDraw,
  onClearFilters,
}: DrawHomeProps) {
  if (filtering && eligibleCount === 0) {
    return (
      <>
        <p className={styles.nothing}>AUCUN FILM NE COLLE</p>
        <div className={styles.actions}>
          <Button variant="primary" onClick={onClearFilters}>
            ENLEVER LES FILTRES
          </Button>
        </div>
      </>
    );
  }
  const { lines, tone } = drawButton(filters, eligibleCount);
  return (
    <button
      type="button"
      className={cx(
        styles.big,
        hasList && styles.compact,
        tone === "pink" && styles.pink,
      )}
      onClick={onDraw}
    >
      <Lines lines={lines} />
    </button>
  );
}
