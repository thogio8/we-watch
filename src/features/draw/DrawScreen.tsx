"use client";

import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
} from "motion/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { ListCounts, Movie } from "@/domain/movie";
import { Headline } from "@/ui/Headline";
import { DrawEmpty } from "./DrawEmpty";
import { DrawExhausted } from "./DrawExhausted";
import { DrawHome } from "./DrawHome";
import { viewVariants } from "./drawMotion";
import { DrawResult } from "./DrawResult";
import styles from "./DrawScreen.module.css";
import { viewKey } from "./drawView";
import { useDraw } from "./useDraw";

interface DrawScreenProps {
  /** The displayed group: each group keeps its own evening. */
  groupId: string;
  toWatch: Movie[];
  counts: ListCounts;
  onWatched: (tmdbId: number) => Promise<void>;
  /** The group pill: in the landmark, outside the animated screens. */
  pill?: ReactNode;
}

/**
 * One screen of the draw. While it leaves (e.g. the torn ticket falling), it is
 * inert: a second tap on RETIRER must not reject a movie nobody has seen yet.
 */
function Screen({
  reduce,
  children,
}: {
  reduce: boolean;
  children: ReactNode;
}) {
  const present = useIsPresent();
  return (
    <motion.div
      className={styles.screen}
      variants={viewVariants(reduce)}
      initial="hidden"
      animate="shown"
      exit="exit"
      inert={!present}
    >
      {children}
    </motion.div>
  );
}

export function DrawScreen({
  groupId,
  toWatch,
  counts,
  onWatched,
  pill,
}: DrawScreenProps) {
  const reduce = useReducedMotion() ?? false;
  const draw = useDraw(groupId, toWatch, onWatched);
  const { view } = draw;
  // Once left, Next keeps this page in memory, asleep: an exit animation
  // started there never ends and would freeze the old screen. Off screen,
  // views swap at once; back on screen, AnimatePresence starts afresh.
  const onScreen = usePathname() === "/";

  const screen = (
    <Screen key={viewKey(view)} reduce={reduce}>
      {view.phase === "home" && (
        <DrawHome
          hasList={toWatch.length > 0}
          counts={counts}
          filters={draw.filters}
          platforms={draw.platforms}
          favoriteCount={draw.favoriteCount}
          matchCount={draw.matchCount}
          onFiltersChange={draw.setFilters}
          filtering={draw.filtering}
          eligibleCount={draw.eligibleCount}
          now={draw.now}
          onDraw={() => draw.draw("draw")}
          onClearFilters={draw.clearFilters}
        />
      )}
      {view.phase === "result" && (
        <DrawResult
          movie={view.movie}
          now={draw.now}
          reduce={reduce}
          ticketRef={draw.ticketRef}
          pile={draw.pile}
          isWatching={draw.isWatching}
          onBack={draw.back}
          onReject={() => draw.draw("reject")}
          onWatch={() => draw.watch(view.movie.tmdbId)}
        />
      )}
      {view.phase === "exhausted" && (
        <DrawExhausted
          pile={draw.pile}
          eligibleCount={draw.eligibleCount}
          filtering={draw.filtering}
          onResetPile={() => draw.draw("reset_pile")}
          onClearFilters={draw.clearFilters}
        />
      )}
      {view.phase === "empty" && <DrawEmpty />}
    </Screen>
  );
  return (
    <main>
      {pill}
      {onScreen ? (
        <AnimatePresence mode="wait" custom={draw.exit} initial={false}>
          {screen}
        </AnimatePresence>
      ) : (
        screen
      )}
    </main>
  );
}

/** Shown while the list loads: the home title, without numbers nor button. */
export function DrawScreenFallback({ pill }: { pill?: ReactNode }) {
  return (
    <main className={styles.screen} aria-busy="true">
      {pill}
      <Headline lines={["CE SOIR", "ON REGARDE"]} className={styles.brand} />
    </main>
  );
}
