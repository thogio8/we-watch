"use client";

import { type ReactNode, useId, useState } from "react";
import {
  BEDTIMES,
  type MoodId,
  MOODS,
  type Platform,
  type TonightFilters,
  type TonightPool,
} from "@/domain/tonight";
import { Chip } from "@/ui/Chip";
import styles from "./TonightPanel.module.css";
import { filtersSummary, toggle } from "./tonightSummary";

interface TonightPanelProps {
  filters: TonightFilters;
  /** Platforms found in the « à voir » list. */
  platforms: readonly Platform[];
  /** « à voir » favourites: the « ON TIRE PARMI » row only shows past 0. */
  favoriteCount: number;
  /** « à voir » matches, likewise. */
  matchCount: number;
  onChange: (filters: TonightFilters) => void;
}

/**
 * Mockup A: bedtime, mood and platforms, every one optional. Folded by
 * default so the draw button stays in sight; the header sums up the choice.
 */
export function TonightPanel(props: TonightPanelProps) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();

  return (
    <section className={styles.panel} aria-label="La soirée">
      <button
        type="button"
        className={styles.header}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen(!open)}
      >
        <span className={styles.title}>LA SOIRÉE</span>
        <span className={styles.summary}>
          {filtersSummary(props.filters, props.platforms)}
        </span>
        <span className={styles.caret} aria-hidden="true">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && <TonightChoices id={bodyId} {...props} />}
    </section>
  );
}

/** The unfolded panel: one row of chips per filter. */
function TonightChoices({
  id,
  filters,
  platforms,
  favoriteCount,
  matchCount,
  onChange,
}: TonightPanelProps & { id: string }) {
  const set = (patch: Partial<TonightFilters>) =>
    onChange({ ...filters, ...patch });

  return (
    <div id={id} className={styles.body}>
      {(favoriteCount > 0 || matchCount > 0) && (
        <PoolChoice
          id={`${id}-among`}
          pool={filters.pool}
          favoriteCount={favoriteCount}
          matchCount={matchCount}
          onChange={(pool) => set({ pool })}
        />
      )}

      <ChipGroup id={`${id}-bedtime`} label="FINI AVANT">
        <Chip
          pressed={filters.bedtime === null}
          onClick={() => set({ bedtime: null })}
        >
          PEU IMPORTE
        </Chip>
        {BEDTIMES.map(({ minutes, label }) => (
          <Chip
            key={minutes}
            pressed={filters.bedtime === minutes}
            onClick={() => set({ bedtime: minutes })}
          >
            {label}
          </Chip>
        ))}
      </ChipGroup>

      <ChipGroup id={`${id}-mood`} label="ON A ENVIE DE…">
        {MOODS.map(({ id: mood, label }) => (
          <Chip
            key={mood}
            pressed={filters.moods.includes(mood)}
            onClick={() => set({ moods: toggle<MoodId>(filters.moods, mood) })}
          >
            {label}
          </Chip>
        ))}
      </ChipGroup>

      {platforms.length > 0 && (
        <ChipGroup id={`${id}-platforms`} label="DISPO CHEZ NOUS">
          <Chip
            pressed={filters.platforms.length === 0}
            onClick={() => set({ platforms: [] })}
          >
            TOUT
          </Chip>
          {platforms.map(({ key, name }) => (
            <Chip
              key={key}
              pressed={filters.platforms.includes(key)}
              onClick={() => set({ platforms: toggle(filters.platforms, key) })}
            >
              {name}
            </Chip>
          ))}
        </ChipGroup>
      )}
    </div>
  );
}

/** « ON TIRE PARMI »: the whole list, or only what has an object. */
function PoolChoice({
  id,
  pool,
  favoriteCount,
  matchCount,
  onChange,
}: {
  id: string;
  pool: TonightPool;
  favoriteCount: number;
  matchCount: number;
  onChange: (pool: TonightPool) => void;
}) {
  return (
    <ChipGroup id={id} label="ON TIRE PARMI">
      <Chip pressed={pool === "all"} onClick={() => onChange("all")}>
        TOUTE LA LISTE
      </Chip>
      {favoriteCount > 0 && (
        <Chip
          tone="pink"
          pressed={pool === "favorites"}
          onClick={() => onChange("favorites")}
        >
          {`♥ NOS COUPS DE CŒUR · ${favoriteCount}`}
        </Chip>
      )}
      {matchCount > 0 && (
        <Chip pressed={pool === "matches"} onClick={() => onChange("matches")}>
          {`♥♥ NOS MATCHS · ${matchCount}`}
        </Chip>
      )}
    </ChipGroup>
  );
}

/** A labelled row of chips; `id` names the label. */
function ChipGroup({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div role="group" aria-labelledby={id}>
      <p id={id} className={styles.label}>
        {label}
      </p>
      <div className={styles.chips}>{children}</div>
    </div>
  );
}
