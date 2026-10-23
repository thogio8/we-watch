import Image from "next/image";
import { type PosterSize, posterUrl } from "@/tmdb/images";
import styles from "./Poster.module.css";

interface PosterProps {
  path: string | null;
  title: string;
  size: PosterSize;
}

/** Fills its sized parent; falls back to the mockup's riso print without a poster. */
export function Poster({ path, title, size }: PosterProps) {
  if (path === null) {
    return (
      <div
        className={`${styles.poster} ${styles.riso}`}
        role="img"
        aria-label={title}
      />
    );
  }
  return (
    <div className={styles.poster}>
      <Image
        src={posterUrl(path, size)}
        alt={`Affiche de ${title}`}
        fill
        className={styles.image}
      />
    </div>
  );
}
