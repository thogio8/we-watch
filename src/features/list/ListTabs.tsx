"use client";

import { type KeyboardEvent, useRef } from "react";
import { cx } from "@/ui/cx";
import styles from "./ListScreen.module.css";
import { otherTab, type Tab, TAB_LABELS, TABS } from "./tabs";

interface ListTabsProps {
  /** Prefix of the tab ids; the panel is `${id}-panel`. */
  id: string;
  tab: Tab;
  counts: Record<Tab, number>;
  onSelect: (tab: Tab) => void;
}

/** « À VOIR · n » / « VUS · n », following the ARIA tabs pattern. */
export function ListTabs({ id, tab, counts, onSelect }: ListTabsProps) {
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  // Tabs pattern: the arrows move between the two tabs.
  const onTabKey = (event: KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = otherTab(tab);
    onSelect(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div
      className={styles.tabs}
      role="tablist"
      aria-label="Listes"
      onKeyDown={onTabKey}
    >
      {TABS.map((key) => (
        <button
          key={key}
          ref={(element) => {
            tabRefs.current[key] = element;
          }}
          type="button"
          role="tab"
          id={`${id}-${key}`}
          aria-selected={tab === key}
          aria-controls={`${id}-panel`}
          tabIndex={tab === key ? 0 : -1}
          className={cx(styles.tab, tab === key && styles.on)}
          onClick={() => onSelect(key)}
        >
          {`${TAB_LABELS[key]} · ${counts[key]}`}
        </button>
      ))}
    </div>
  );
}
