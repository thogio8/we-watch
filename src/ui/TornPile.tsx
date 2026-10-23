import styles from "./TornPile.module.css";

interface TornPileProps {
  count: number;
  label: string;
}

/** Tilts of the stacked torn tickets, as drawn in the mockup. */
const TILTS = [0, -8, 9, -6, 12] as const;

export function TornPile({ count, label }: TornPileProps) {
  if (count <= 0) return null;
  const visible = TILTS.slice(0, Math.min(count, TILTS.length));
  return (
    <div className={styles.pile}>
      <span className={styles.stack} aria-hidden="true">
        {visible.map((tilt, index) => (
          <span
            key={index}
            className={styles.torn}
            style={{ transform: `rotate(${tilt}deg)` }}
          />
        ))}
      </span>
      <span>
        {label}&nbsp;: {count}
      </span>
    </div>
  );
}
