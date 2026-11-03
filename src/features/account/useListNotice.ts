"use client";

import { useRef, useState } from "react";

/**
 * A list's outcome that outlives its row: the row may go when the list is
 * reloaded, so the message and the focus go to the section instead.
 */
export function useListNotice() {
  const title = useRef<HTMLHeadingElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const focusTitle = () => title.current?.focus();
  return { title, notice, setNotice, focusTitle };
}
