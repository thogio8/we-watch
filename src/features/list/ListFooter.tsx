import Image from "next/image";
import styles from "./ListScreen.module.css";

/** TMDB and JustWatch attributions. */
export function ListFooter() {
  return (
    <footer className={styles.footer}>
      <a
        className={styles.tmdb}
        href="https://www.themoviedb.org/"
        target="_blank"
        rel="noopener noreferrer"
      >
        {/* Official logo, unaltered (public/tmdb-logo.svg, from themoviedb.org). */}
        <Image src="/tmdb-logo.svg" alt="TMDB" width={123} height={16} />
      </a>
      <p>
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </p>
      <p>
        Disponibilités :{" "}
        <a
          href="https://www.justwatch.com/fr"
          target="_blank"
          rel="noopener noreferrer"
        >
          JustWatch
        </a>
      </p>
    </footer>
  );
}
