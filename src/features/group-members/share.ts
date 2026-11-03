/** What the browser offers: the share sheet (phones), the clipboard (https). */
export interface Sharer {
  share?: (data: ShareData) => Promise<void>;
  clipboard?: { writeText(text: string): Promise<void> };
}

export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

export function canShare(sharer: Sharer): boolean {
  return typeof sharer.share === "function";
}

const cancelled = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

/**
 * The share sheet when there is one, else the clipboard. "failed" when
 * neither works: the link is then shown to be selected by hand.
 */
export async function shareOrCopy(
  url: string,
  sharer: Sharer,
): Promise<ShareOutcome> {
  if (sharer.share) {
    try {
      // Called on the navigator: detached, it throws « Illegal invocation ».
      await sharer.share({ url });
      return "shared";
    } catch (error) {
      if (cancelled(error)) return "cancelled";
    }
  }
  // No clipboard outside https.
  if (!sharer.clipboard) return "failed";
  try {
    await sharer.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}
