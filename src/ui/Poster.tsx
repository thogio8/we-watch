import Image from "next/image";
import { type PosterSize, posterUrl } from "@/tmdb/images";
import styles from "./Poster.module.css";

interface PosterProps {
  path: string | null;
  title: string;
  size: PosterSize;
}

const RENDERED_WIDTH: Record<PosterSize, string> = {
  w92: "92px",
  w342: "342px",
  w500: "480px",
};

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
        sizes={RENDERED_WIDTH[size]}
        className={styles.image}
      />
    </div>
  );
}
