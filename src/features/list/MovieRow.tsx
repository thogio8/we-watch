import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Poster } from "@/ui/Poster";
import styles from "./MovieRow.module.css";
import { cx } from "@/ui/cx";

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
  /** The movie's page: poster and title open it (the button stays apart). */
  href?: string;
}

/** The rows of a list or of the search results. */
export function RowList({
  busy = false,
  children,
}: {
  /** The rows answer an older query while a newer one is on its way. */
  busy?: boolean;
  children: ReactNode;
}) {
  return (
    <ul className={styles.list} aria-busy={busy || undefined}>
      {children}
    </ul>
  );
}

/** One film of the list or of the search results (mockup screens 5-7). */
export function MovieRow({
  title,
  posterPath,
  children,
  action,
  muted = false,
  busy = false,
  href,
}: MovieRowProps) {
  const classes = cx(styles.row, muted && styles.muted, busy && styles.busy);
  const content = (
    <>
      <div className={styles.thumb}>
        <Poster path={posterPath} title={title} size="w92" />
      </div>
      <div className={styles.body}>
        <h2 className={styles.title}>{title}</h2>
        {children}
      </div>
    </>
  );
  return (
    <li className={classes} aria-busy={busy || undefined} inert={busy}>
      {href ? (
        <Link href={href} className={styles.link}>
          {content}
        </Link>
      ) : (
        content
      )}
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

/** Empty list, no result, TMDB down: a dashed ticket stub in place of the rows. */
export function ListMessage({
  title,
  children,
  live = false,
}: {
  title: string;
  children?: ReactNode;
  /** Announced to screen readers, e.g. the search's answers. */
  live?: boolean;
}) {
  return (
    <div className={styles.message} role={live ? "status" : undefined}>
      <p className={styles.messageTitle}>{title}</p>
      {children && <p className={styles.messageText}>{children}</p>}
    </div>
  );
}

/** A save that failed: the row is usable again, and this says so. */
export function ListAlert({ children }: { children: ReactNode }) {
  return (
    <p className={styles.alert} role="alert">
      {children}
    </p>
  );
}
