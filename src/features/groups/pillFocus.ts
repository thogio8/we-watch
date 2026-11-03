import type { CreateGroupResult } from "./actions";

/**
 * A group created on the first group screen replaces it with the pill: the
 * focus, lost with the screen, goes to the pill. The request is made before
 * the action runs (its answer already re-renders the page with the pill) and
 * kept in sessionStorage: no module state, and the router leaves it alone
 * (it rewrites the URL, so a fragment would be lost).
 */
const PILL_FOCUS_KEY = "ww-pill-focus";

/** True once after a request. Private browsing: never, nothing breaks. */
export function takePillFocus(): boolean {
  try {
    const asked = sessionStorage.getItem(PILL_FOCUS_KEY) !== null;
    sessionStorage.removeItem(PILL_FOCUS_KEY);
    return asked;
  } catch {
    return false;
  }
}

function requestPillFocus(): void {
  try {
    sessionStorage.setItem(PILL_FOCUS_KEY, "1");
  } catch {
    // The focus just stays where the browser puts it.
  }
}

type Create = (formData: FormData) => Promise<CreateGroupResult>;

/** `create`, asking the next pill for the focus unless it fails. */
export function withPillFocus(create: Create): Create {
  return async (formData) => {
    requestPillFocus();
    try {
      const result = await create(formData);
      if (!result.ok) takePillFocus();
      return result;
    } catch (error) {
      takePillFocus();
      throw error;
    }
  };
}
