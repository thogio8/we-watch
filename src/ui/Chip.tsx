import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./Chip.module.css";
import { cx } from "./cx";

interface ChipProps {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  /** Pink once pressed (« ♥ NOS COUPS DE CŒUR »), yellow by default. */
  tone?: "pink";
}

/** A toggle in a row of choices (filters « ce soir »). */
export function Chip({ pressed, onClick, children, tone }: ChipProps) {
  return (
    <button
      type="button"
      className={cx(styles.chip, tone === "pink" && styles.pink)}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

interface ChipLinkProps {
  href: string;
  current: boolean;
  children: ReactNode;
}

/** A chip that navigates (themed swipe decks). */
export function ChipLink({ href, current, children }: ChipLinkProps) {
  return (
    <Link
      href={href}
      className={styles.chip}
      aria-current={current ? "page" : undefined}
      replace
      scroll={false}
    >
      {children}
    </Link>
  );
}
