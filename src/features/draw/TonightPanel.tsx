"use client";

import type { StreamingProvider } from "@/domain/movie";
import {
  BEDTIMES,
  type MoodId,
  MOODS,
  type TonightFilters,
} from "@/domain/tonight";
import { Chip } from "@/ui/Chip";
import styles from "./TonightPanel.module.css";

interface TonightPanelProps {
  filters: TonightFilters;
  /** Platforms found in the « à voir » list. */
  providers: readonly StreamingProvider[];
  onChange: (filters: TonightFilters) => void;
}

const toggle = <T,>(list: readonly T[], item: T): T[] =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

/** Mockup A: bedtime, mood and platforms, every one optional. */
export function TonightPanel({
  filters,
  providers,
  onChange,
}: TonightPanelProps) {
  const set = (patch: Partial<TonightFilters>) =>
    onChange({ ...filters, ...patch });

  return (
    <section className={styles.panel} aria-label="La soirée">
      <div role="group" aria-labelledby="tonight-bedtime">
        <p id="tonight-bedtime" className={styles.label}>
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

      <div role="group" aria-labelledby="tonight-mood">
        <p id="tonight-mood" className={styles.label}>
          ON A ENVIE DE…
        </p>
        <div className={styles.chips}>
          {MOODS.map(({ id, label }) => (
            <Chip
              key={id}
              pressed={filters.moods.includes(id)}
              onClick={() => set({ moods: toggle<MoodId>(filters.moods, id) })}
            >
              {label}
            </Chip>
          ))}
        </div>
      </div>

      {providers.length > 0 && (
        <div role="group" aria-labelledby="tonight-providers">
          <p id="tonight-providers" className={styles.label}>
            DISPO CHEZ NOUS
          </p>
          <div className={styles.chips}>
            <Chip
              pressed={filters.providerIds.length === 0}
              onClick={() => set({ providerIds: [] })}
            >
              TOUT
            </Chip>
            {providers.map(({ id, name }) => (
              <Chip
                key={id}
                pressed={filters.providerIds.includes(id)}
                onClick={() =>
                  set({ providerIds: toggle(filters.providerIds, id) })
                }
              >
                {name}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
