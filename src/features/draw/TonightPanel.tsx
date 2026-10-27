"use client";

import { useId, useState } from "react";
import {
  BEDTIMES,
  type MoodId,
  MOODS,
  type Platform,
  type TonightFilters,
} from "@/domain/tonight";
import { Chip } from "@/ui/Chip";
import styles from "./TonightPanel.module.css";

interface TonightPanelProps {
  filters: TonightFilters;
  /** Platforms found in the « à voir » list. */
  platforms: readonly Platform[];
  onChange: (filters: TonightFilters) => void;
}

const toggle = <T,>(list: readonly T[], item: T): T[] =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

/** « AVANT MINUIT · RIRE · NETFLIX », or « AUCUN FILTRE ». */
export function filtersSummary(
  filters: TonightFilters,
  platforms: readonly Platform[],
): string {
  const bedtime = BEDTIMES.find((b) => b.minutes === filters.bedtime);
  const parts = [
    ...(bedtime ? [`AVANT ${bedtime.label}`] : []),
    ...MOODS.filter((m) => filters.moods.includes(m.id)).map((m) => m.label),
    ...platforms
      .filter((p) => filters.platforms.includes(p.key))
      .map((p) => p.name.toUpperCase()),
  ];
  return parts.length > 0 ? parts.join(" · ") : "AUCUN FILTRE";
}

/**
 * Mockup A: bedtime, mood and platforms, every one optional. Folded by
 * default so the draw button stays in sight; the header sums up the choice.
 */
export function TonightPanel({
  filters,
  platforms,
  onChange,
}: TonightPanelProps) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const set = (patch: Partial<TonightFilters>) =>
    onChange({ ...filters, ...patch });

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
          {filtersSummary(filters, platforms)}
        </span>
        <span className={styles.caret} aria-hidden="true">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div id={bodyId} className={styles.body}>
          <div role="group" aria-labelledby={`${bodyId}-bedtime`}>
            <p id={`${bodyId}-bedtime`} className={styles.label}>
              FINI AVANT
            </p>
            <div className={styles.chips}>
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
            </div>
          </div>

          <div role="group" aria-labelledby={`${bodyId}-mood`}>
            <p id={`${bodyId}-mood`} className={styles.label}>
              ON A ENVIE DE…
            </p>
            <div className={styles.chips}>
              {MOODS.map(({ id, label }) => (
                <Chip
                  key={id}
                  pressed={filters.moods.includes(id)}
                  onClick={() =>
                    set({ moods: toggle<MoodId>(filters.moods, id) })
                  }
                >
                  {label}
                </Chip>
              ))}
            </div>
          </div>

          {platforms.length > 0 && (
            <div role="group" aria-labelledby={`${bodyId}-platforms`}>
              <p id={`${bodyId}-platforms`} className={styles.label}>
                DISPO CHEZ NOUS
              </p>
              <div className={styles.chips}>
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
                    onClick={() =>
                      set({ platforms: toggle(filters.platforms, key) })
                    }
                  >
                    {name}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
