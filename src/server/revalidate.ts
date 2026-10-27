import "server-only";
import { revalidatePath } from "next/cache";

/**
 * After any change to the list: TIRER, LISTE and the movie pages are stale.
 * The phone keeps visited pages for 5 minutes (next.config.ts staleTimes), so
 * every write must say so. Only the page on screen re-renders at once: from
 * SWIPER, the deck is left alone (its cards come from TMDB).
 */
export function revalidateListPages(): void {
  revalidatePath("/");
  revalidatePath("/list", "layout");
}
