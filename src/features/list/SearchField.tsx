"use client";

import { type ChangeEvent, useRef } from "react";
import styles from "./SearchPanel.module.css";

/** Same cap as the server action. */
const MAX_QUERY_LENGTH = 100;

interface SearchFieldProps {
  value: string;
  onChange: (next: string) => void;
}

/** The « AJOUTER UN FILM… » field, with its clear button. */
export function SearchField({ value, onChange }: SearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const clear = () => {
    onChange("");
    inputRef.current?.focus();
  };

  return (
    <div className={styles.search}>
      <span className={styles.icon} aria-hidden="true">
        ⌕
      </span>
      <input
        ref={inputRef}
        className={styles.input}
        type="search"
        aria-label="Ajouter un film"
        placeholder="AJOUTER UN FILM…"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        maxLength={MAX_QUERY_LENGTH}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange(event.target.value)
        }
      />
      {value !== "" && (
        <button
          type="button"
          className={styles.clear}
          aria-label="Effacer la recherche"
          onClick={clear}
        >
          ✕
        </button>
      )}
    </div>
  );
}
