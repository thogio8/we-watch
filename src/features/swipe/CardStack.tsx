"use client";

import { AnimatePresence, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { MovieSnapshot } from "@/domain/movie";
import { Button } from "@/ui/Button";
import type { SwipeDecision } from "./actions";
import type { DeckCard } from "./deck";
import { SwipeCard } from "./SwipeCard";
import styles from "./SwipeDeck.module.css";

interface CardStackProps {
  queue: DeckCard[];
  lastDecision: SwipeDecision;
  onDecide: (card: MovieSnapshot, decision: SwipeDecision) => void;
}

/**
 * The top two tickets and the buttons. While a card flies out, the buttons
 * wait, so a double tap cannot decide the next film before anyone has seen
 * it. The lock is the set of leaving ids, cleared when every exit completes.
 * A card whose save failed comes back mid-flight: AnimatePresence then never
 * reports the end of its exit, so a leaving id back in the queue no longer
 * locks. The lock also resets with the stack whenever the deck runs dry.
 */
export function CardStack({ queue, lastDecision, onDecide }: CardStackProps) {
  const reduce = useReducedMotion() ?? false;
  const [leavingIds, setLeavingIds] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const [top] = queue;
  if (!top) return null;

  const queued = new Set(queue.map((card) => card.tmdbId));
  const locked = [...leavingIds].some((id) => !queued.has(id));

  const decide = (card: MovieSnapshot, decision: SwipeDecision) => {
    setLeavingIds((ids) => new Set(ids).add(card.tmdbId));
    onDecide(card, decision);
  };
  const choose = (decision: SwipeDecision) => {
    if (!locked) decide(top, decision);
  };

  return (
    <>
      <section
        className={styles.deck}
        aria-label="Film à trier"
        aria-busy={locked || undefined}
      >
        <AnimatePresence
          custom={lastDecision}
          initial={false}
          onExitComplete={() => setLeavingIds(new Set())}
        >
          {/* Behind first: later grid items paint on top. */}
          {queue
            .slice(0, 2)
            .reverse()
            .map((card) => (
              <SwipeCard
                key={card.tmdbId}
                movie={card}
                position={card === top ? "top" : "behind"}
                reduce={reduce}
                onDecide={(decision) => decide(card, decision)}
              />
            ))}
        </AnimatePresence>
      </section>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => choose("reject")}>
          ✕ BOF
        </Button>
        <Button variant="love" onClick={() => choose("keep")}>
          ON LE VEUT ♥
        </Button>
      </div>
    </>
  );
}
