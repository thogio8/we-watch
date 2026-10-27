import type { DeckState, Toast } from "./deckState";
import styles from "./SwipeDeck.module.css";

const TOASTS: Record<Toast, string> = {
  save_failed: "PAS RÉUSSI À ENREGISTRER, RÉESSAIE",
  undo_failed: "PAS RÉUSSI À ANNULER",
};

interface DeckNoticeProps {
  toast: DeckState["toast"];
  undoable: DeckState["undoable"];
  onUndo: () => void;
}

/** A failure message, otherwise the « ↺ ANNULER » slip of the last swipe. */
export function DeckNotice({ toast, undoable, onUndo }: DeckNoticeProps) {
  if (toast !== null) {
    return (
      <p role="alert" className={styles.toast}>
        {TOASTS[toast]}
      </p>
    );
  }
  if (undoable === null) return null;
  return (
    <div className={styles.undo} role="status">
      <span className={styles.undoText}>
        {undoable.decision === "keep" ? "♥ " : "✕ "}
        {undoable.card.title}
      </span>
      <button type="button" className={styles.undoButton} onClick={onUndo}>
        ↺ ANNULER
      </button>
    </div>
  );
}
