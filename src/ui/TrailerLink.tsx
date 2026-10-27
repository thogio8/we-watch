import styles from "./TrailerLink.module.css";

/** « ▶ BANDE-ANNONCE »: YouTube in a new tab (the app opens on iPhone). */
export function TrailerLink({
  trailerKey,
  title,
}: {
  trailerKey: string | null;
  title: string;
}) {
  if (trailerKey === null) return null;
  return (
    <a
      className={styles.trailer}
      href={`https://www.youtube.com/watch?v=${encodeURIComponent(trailerKey)}`}
      target="_blank"
      rel="noreferrer"
      aria-label={`Bande-annonce de ${title} (YouTube)`}
    >
      ▶ BANDE-ANNONCE
    </a>
  );
}
