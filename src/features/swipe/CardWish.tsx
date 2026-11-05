import { wishBanner } from "@/domain/wish-banner";
import { MatchStamp } from "@/ui/MatchStamp";
import styles from "./CardWish.module.css";
import type { DeckCard } from "./deck";

/**
 * Bottom-left of the poster, for a movie the group wants: the small match
 * stamp if it is one already, above the white banner of who wants it.
 */
export function CardWish({ wish }: { wish: NonNullable<DeckCard["wish"]> }) {
  const banner = wishBanner(wish.others);
  return (
    <div className={styles.wish}>
      {wish.matched && <MatchStamp size="small" className={styles.match} />}
      {banner !== null && (
        <p className={styles.banner}>
          <span aria-hidden="true" className={styles.heart}>
            ♥
          </span>{" "}
          {banner}
        </p>
      )}
    </div>
  );
}
