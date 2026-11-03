"use client";

import { type ReactNode, type RefObject, useId } from "react";
import sheet from "@/ui/Sheet.module.css";
import styles from "./Account.module.css";

interface ListSectionProps {
  title: string;
  titleRef: RefObject<HTMLHeadingElement | null>;
  notice: string | null;
  /** The rows (<li>). */
  children: ReactNode;
  /** Below the list. */
  after?: ReactNode;
}

/** « TES CLÉS D’ACCÈS », « TES APPAREILS »: a titled slip of rows. */
export function ListSection({
  title,
  titleRef,
  notice,
  children,
  after,
}: ListSectionProps) {
  const titleId = useId();
  return (
    <section className={sheet.sheet} aria-labelledby={titleId}>
      <h2 ref={titleRef} id={titleId} className={sheet.title} tabIndex={-1}>
        {title}
      </h2>
      {notice !== null && (
        <p className={styles.notice} role="alert">
          {notice}
        </p>
      )}
      <ul className={sheet.rows} aria-labelledby={titleId}>
        {children}
      </ul>
      {after}
    </section>
  );
}
