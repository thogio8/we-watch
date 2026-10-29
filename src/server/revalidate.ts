import "server-only";
import { revalidatePath } from "next/cache";

/**
 * After any change to a group's list: TIRER, LISTE and the movie pages are
 * stale. The phone keeps visited pages for 5 minutes (next.config.ts
 * staleTimes), so every write must say so. SWIPER is left alone: refreshing
 * the page on screen mid-swipe would reload the deck.
 */
export function revalidateListPages(): void {
  revalidatePath("/");
  revalidatePath("/list", "layout");
}

/** Another group displayed (created or chosen): SWIPER's deck too. */
export function revalidateGroupPages(): void {
  revalidateListPages();
  revalidatePath("/swipe");
}
