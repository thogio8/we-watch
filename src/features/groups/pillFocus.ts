/**
 * A group created on the first group screen replaces it with the pill on the
 * next render: the focus, lost with the screen, goes to the pill.
 */
let pending = false;

export function requestPillFocus(): void {
  pending = true;
}

/** True once after requestPillFocus(). */
export function takePillFocus(): boolean {
  const take = pending;
  pending = false;
  return take;
}
