"use client";

import { type ReactNode, useId, useState } from "react";
import type { Movie } from "@/domain/movie";
import { Headline } from "@/ui/Headline";
import { ListFooter } from "./ListFooter";
import { ListRow } from "./ListRow";
import styles from "./ListScreen.module.css";
import { ListTabs } from "./ListTabs";
import { EMPTY, type Tab } from "./tabs";
import { ListAlert, ListMessage, RowList } from "./MovieRow";
import { type SearchActions, SearchPanel } from "./SearchPanel";
import { type ListAction, useListAction } from "./useListAction";

interface ListScreenProps {
  toWatch: Movie[];
  watched: Movie[];
  onRemove: ListAction;
  onUnwatch: ListAction;
  /** « AJOUTER UN FILM… » above the tabs; its results replace the list. */
  search?: SearchActions;
  /** The group pill, first in the landmark. */
  pill?: ReactNode;
}

export function ListScreen({
  toWatch,
  watched,
  onRemove,
  onUnwatch,
  search,
  pill,
}: ListScreenProps) {
  // The tab lives here, so it survives a search replacing the list.
  const [tab, setTab] = useState<Tab>("toWatch");
  const { failed, run } = useListAction();
  const id = useId();

  const shown = { toWatch, watched }[tab];
  const counts = { toWatch: toWatch.length, watched: watched.length };

  const lists: ReactNode = (
    <>
      <ListTabs id={id} tab={tab} counts={counts} onSelect={setTab} />

      {failed && <ListAlert>PAS RÉUSSI À ENREGISTRER, RÉESSAIE</ListAlert>}

      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`}>
        {shown.length === 0 ? (
          <ListMessage title={EMPTY[tab].title}>{EMPTY[tab].text}</ListMessage>
        ) : (
          <RowList>
            {shown.map((movie) => (
              <ListRow
                key={movie.tmdbId}
                movie={movie}
                run={run}
                onRemove={onRemove}
                onUnwatch={onUnwatch}
              />
            ))}
          </RowList>
        )}
      </div>
    </>
  );

  return (
    <main className={styles.screen}>
      {pill}
      <Headline lines={["NOTRE LISTE"]} size="medium" />
      {search ? <SearchPanel {...search}>{lists}</SearchPanel> : lists}
      <ListFooter />
    </main>
  );
}

/** Shown while the list loads: the title alone. */
export function ListScreenFallback({ pill }: { pill?: ReactNode }) {
  return (
    <main className={styles.screen} aria-busy="true">
      {pill}
      <Headline lines={["NOTRE LISTE"]} size="medium" />
    </main>
  );
}
