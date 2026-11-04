"use client";

import { Fragment, type ReactNode, useId } from "react";
import type { Movie } from "@/domain/movie";
import styles from "./ListScreen.module.css";
import { RowList } from "./MovieRow";
import { toWatchSections } from "./toWatchSections";

interface ToWatchListProps {
  movies: readonly Movie[];
  row: (movie: Movie) => ReactNode;
}

/**
 * « À VOIR »: favourites first under « ♥ COUPS DE CŒUR · n », then
 * « LE RESTE · n ». The headings are paragraphs, not titles: each film's
 * title is the panel's only heading level. Each section has its own grid.
 */
export function ToWatchList({ movies, row }: ToWatchListProps) {
  const id = useId();
  return toWatchSections(movies).map(({ key, title, movies: shown }) => {
    const rows = shown.map(row);
    if (title === null) return <RowList key={key}>{rows}</RowList>;
    const headingId = `${id}-${key}`;
    return (
      <Fragment key={key}>
        <p id={headingId} className={styles.section}>
          {title}
        </p>
        <RowList labelledBy={headingId}>{rows}</RowList>
      </Fragment>
    );
  });
}
