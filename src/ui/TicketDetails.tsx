import type { MovieSnapshot } from "@/domain/movie";
import { distinctPlatforms } from "@/domain/tonight";
import { movieMeta } from "./movieMeta";
import { ProviderTags } from "./ProviderTags";
import styles from "./TicketDetails.module.css";
import { TrailerLink } from "./TrailerLink";
import { cx } from "./cx";

interface TicketDetailsProps {
  movie: MovieSnapshot;
  /**
   * "all": every platform as a tag. "beyond-stamp": the first platform is
   * already stamped on the poster (swipe card), so tags only when there are
   * more.
   */
  platforms: "all" | "beyond-stamp";
  /** Swipe cards keep one height: the title stops at two lines. */
  clampTitle?: boolean;
  /** The lying ticket carries a stamp at the top right of the stub. */
  stampRoom?: boolean;
}

/** The stub of a movie ticket: title, meta, platforms, trailer, summary. */
export function TicketDetails({
  movie,
  platforms,
  clampTitle = false,
  stampRoom = false,
}: TicketDetailsProps) {
  const titleClasses = cx(
    styles.title,
    clampTitle && styles.clamped,
    stampRoom && styles.stampRoom,
  );
  const showTags =
    platforms === "all" || distinctPlatforms(movie.providers).length > 1;
  return (
    <>
      <h2 className={titleClasses}>{movie.title}</h2>
      <p className={styles.meta}>{movieMeta(movie)}</p>
      {showTags && <ProviderTags providers={movie.providers} />}
      <TrailerLink trailerKey={movie.trailerKey} title={movie.title} />
      {movie.overview && <p className={styles.overview}>{movie.overview}</p>}
    </>
  );
}
