import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./Chip.module.css";

interface ChipProps {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}

/** A toggle in a row of choices (filters « ce soir »). */
export function Chip({ pressed, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      className={styles.chip}
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
