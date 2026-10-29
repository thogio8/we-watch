import "server-only";
import { revalidatePath } from "next/cache";

/**
 * After any change to a group's list, or to the displayed group: TIRER,
 * LISTE, the movie pages and SWIPER are stale (the deck leaves out the
 * group's list). The phone keeps visited pages for 5 minutes (next.config.ts
 * staleTimes), so every write must say so.
 */
export function revalidateGroupPages(): void {
  revalidatePath("/");
  revalidatePath("/list", "layout");
  revalidatePath("/swipe");
}
