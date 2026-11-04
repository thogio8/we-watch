"use client";

import { type RefObject, useEffect, useEffectEvent } from "react";

/**
 * For a controlled field shown before React hydrates it (a slow phone):
 * what was typed, pasted or dictated meanwhile is on screen but never
 * reached `onChange`. Once mounted, a value the field already holds that
 * differs from `value` is adopted, as if just typed.
 */
export function useAdoptPrefilledValue(
  field: RefObject<HTMLInputElement | null>,
  value: string,
  onChange: (next: string) => void,
) {
  const adopt = useEffectEvent(() => {
    const typed = field.current?.value;
    if (typed !== undefined && typed !== value) onChange(typed);
  });
  useEffect(() => adopt(), []);
}
