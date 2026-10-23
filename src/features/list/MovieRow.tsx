import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Poster } from "@/ui/Poster";
import styles from "./MovieRow.module.css";

interface MovieRowProps {
  title: string;
  posterPath: string | null;
  /** Meta lines under the title. */
  children: ReactNode;
  /** The row's one button (or its inactive state), on the right. */
  action: ReactNode;
  /** Faded, as the « vus » rows of the mockup. */
  muted?: boolean;
  /** Saving: the row is faded and cannot be tapped again. */
  busy?: boolean;
}

/** One film of the list or of the search results (mockup screens 5-7). */
export function MovieRow({
  title,
  posterPath,
  children,
  action,
  muted = false,
  busy = false,
}: MovieRowProps) {
  const classes = [styles.row, muted && styles.muted, busy && styles.busy]
    .filter(Boolean)
    .join(" ");
  return (
    <li className={classes} aria-busy={busy || undefined} inert={busy}>
      <div className={styles.thumb}>
        <Poster path={posterPath} title={title} size="w92" />
      </div>
      <div className={styles.body}>
        <h2 className={styles.title}>{title}</h2>
        {children}
      </div>
      <div className={styles.action}>{action}</div>
    </li>
  );
}

/** « 2h05 · Netflix », « Vu le 18/10 », « 2021 · 2h35 · ★7,8 ». */
export function RowMeta({ children }: { children: ReactNode }) {
  return <p className={styles.meta}>{children}</p>;
}

interface RowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** « + AJOUTER » is the yellow call to action; ✕ and ↺ stay on paper. */
  tone: "paper" | "yellow";
  children: ReactNode;
}

export function RowButton({ tone, children, ...rest }: RowButtonProps) {
  return (
    <button
      type="button"
      className={`${styles.chip} ${styles[tone]}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Inactive state in place of a button, e.g. « ✓ À VOIR ». */
export function RowDone({ children }: { children: ReactNode }) {
  return <span className={`${styles.chip} ${styles.done}`}>{children}</span>;
}
