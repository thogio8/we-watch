import { describe, expect, it } from "vitest";
import { aSnapshot } from "@tests/helpers/movies";
import type { MovieSnapshot } from "@/domain/movie";
import { type DeckState, deckReducer, deckView, initDeck } from "./deckState";

const ids = (state: DeckState) => state.queue.map((card) => card.tmdbId);
const cards = (...tmdbIds: number[]) => tmdbIds.map((id) => aSnapshot(id));

function deckOf(tmdbIds: number[], nextPage: number | null = 2): DeckState {
  return initDeck({ ok: true, batch: { cards: cards(...tmdbIds), nextPage } });
}

function decide(state: DeckState, card: MovieSnapshot, keep = true) {
  return deckReducer(state, {
    type: "decided",
    card,
    decision: keep ? "keep" : "reject",
  });
}

describe("initDeck", () => {
  it("part du premier lot chargé", () => {
    const state = deckOf([1, 2], 2);
    expect(ids(state)).toEqual([1, 2]);
    expect(state.nextPage).toBe(2);
    expect(state.loadFailed).toBe(false);
    expect(state.undoable).toBeNull();
    expect(state.toast).toBeNull();
    expect(state.lastDecision).toBe("keep");
  });

  it("note l'échec quand le premier lot n'a pas pu être chargé", () => {
    const state = initDeck({ ok: false });
    expect(state.queue).toEqual([]);
    expect(state.nextPage).toBe(1);
    expect(state.loadFailed).toBe(true);
  });
});

describe("deckReducer", () => {
  it("ajoute un lot sans doublon ni film déjà décidé", () => {
    const one = aSnapshot(1);
    const state = decide(deckOf([1, 2]), one);
    const next = deckReducer(state, {
      type: "loaded",
      batch: { cards: cards(1, 2, 3, 3, 4), nextPage: null },
    });
    expect(ids(next)).toEqual([2, 3, 4]);
    expect(next.nextPage).toBeNull();
  });

  it("une file renvoyée à la page 1 ne s'affiche pas deux fois, ni une carte décidée", () => {
    // TMDB was down: the server served the queue alone, then serves it again.
    const wanted = cards(7, 8);
    const state = initDeck({
      ok: true,
      batch: { cards: wanted, nextPage: 1 },
    });
    const next = deckReducer(decide(state, aSnapshot(7), false), {
      type: "loaded",
      batch: { cards: [...wanted, aSnapshot(9)], nextPage: 2 },
    });
    expect(ids(next)).toEqual([8, 9]);
  });

  it("un lot chargé efface l'échec précédent", () => {
    const failed = deckReducer(deckOf([]), { type: "load_failed" });
    expect(failed.loadFailed).toBe(true);
    const next = deckReducer(failed, {
      type: "loaded",
      batch: { cards: cards(5), nextPage: 3 },
    });
    expect(next.loadFailed).toBe(false);
  });

  it("RÉESSAYER relance le chargement", () => {
    const failed = deckReducer(deckOf([]), { type: "load_failed" });
    expect(deckReducer(failed, { type: "retry" }).loadFailed).toBe(false);
  });

  it("une décision retire la carte et propose de l'annuler", () => {
    const one = aSnapshot(1);
    const withToast = { ...deckOf([1, 2]), toast: "undo_failed" as const };
    const state = decide(withToast, one, false);
    expect(ids(state)).toEqual([2]);
    expect(state.decided.has(1)).toBe(true);
    expect(state.lastDecision).toBe("reject");
    expect(state.undoable).toEqual({ card: one, decision: "reject" });
    expect(state.toast).toBeNull();
  });

  it("un enregistrement raté remet la carte en haut, sans annulation", () => {
    const one = aSnapshot(1);
    const state = deckReducer(decide(deckOf([1, 2]), one), {
      type: "decide_failed",
      card: one,
    });
    expect(ids(state)).toEqual([1, 2]);
    expect(state.decided.has(1)).toBe(false);
    expect(state.undoable).toBeNull();
    expect(state.toast).toBe("save_failed");
  });

  it("un enregistrement raté sans annulation en cours ne duplique pas la carte", () => {
    const next = deckReducer(deckOf([1, 2]), {
      type: "decide_failed",
      card: aSnapshot(1),
    });
    expect(ids(next)).toEqual([1, 2]);
    expect(next.undoable).toBeNull();
  });

  it("un enregistrement raté garde l'annulation d'un autre film", () => {
    const one = aSnapshot(1);
    const two = aSnapshot(2);
    const state = decide(decide(deckOf([1, 2, 3]), one), two);
    const next = deckReducer(state, { type: "decide_failed", card: one });
    expect(ids(next)).toEqual([1, 3]);
    expect(next.undoable).toEqual({ card: two, decision: "keep" });
  });

  it("ANNULER remet la dernière carte en haut", () => {
    const one = aSnapshot(1);
    const state = deckReducer(decide(deckOf([1, 2]), one), {
      type: "undone",
    });
    expect(ids(state)).toEqual([1, 2]);
    expect(state.decided.has(1)).toBe(false);
    expect(state.undoable).toBeNull();
  });

  it("ANNULER sans rien à annuler ne change rien", () => {
    const state = deckOf([1]);
    expect(deckReducer(state, { type: "undone" })).toBe(state);
  });

  it("une annulation ratée fait repartir la carte, toujours décidée", () => {
    const one = aSnapshot(1);
    const undone = deckReducer(decide(deckOf([1, 2]), one), {
      type: "undone",
    });
    const state = deckReducer(undone, { type: "undo_failed", tmdbId: 1 });
    expect(ids(state)).toEqual([2]);
    expect(state.decided.has(1)).toBe(true);
    expect(state.toast).toBe("undo_failed");
  });

  it("l'annulation et le message disparaissent quand on les congédie", () => {
    const one = aSnapshot(1);
    const state = {
      ...decide(deckOf([1]), one),
      toast: "save_failed" as const,
    };
    expect(deckReducer(state, { type: "dismiss_undo" }).undoable).toBeNull();
    expect(deckReducer(state, { type: "dismiss_toast" }).toast).toBeNull();
  });
});

describe("deckView", () => {
  it("montre les cartes tant qu'il en reste", () => {
    expect(deckView(deckOf([1], null))).toBe("cards");
  });

  it("annonce la fin quand la dernière page est lue", () => {
    expect(deckView(deckOf([], null))).toBe("end");
  });

  it("montre l'erreur quand le chargement a échoué", () => {
    expect(deckView(initDeck({ ok: false }))).toBe("error");
  });

  it("attend le chargement sinon", () => {
    expect(deckView(deckOf([], 2))).toBe("loading");
  });
});
