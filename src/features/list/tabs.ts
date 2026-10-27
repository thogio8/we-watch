export type Tab = "toWatch" | "watched";

export const TABS: readonly Tab[] = ["toWatch", "watched"];

export const TAB_LABELS: Record<Tab, string> = {
  toWatch: "À VOIR",
  watched: "VUS",
};

export const EMPTY: Record<Tab, { title: string; text: string }> = {
  toWatch: {
    title: "RIEN À VOIR POUR L’INSTANT",
    text: "Swipez quelques films, ou cherchez-en un au-dessus",
  },
  watched: {
    title: "AUCUN FILM VU POUR L’INSTANT",
    text: "Les films tirés et regardés atterrissent ici",
  },
};

/** Two tabs: either arrow moves to the other one. */
export const otherTab = (tab: Tab): Tab =>
  tab === "toWatch" ? "watched" : "toWatch";
