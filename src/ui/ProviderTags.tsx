import type { StreamingProvider } from "@/domain/movie";
import { distinctPlatforms } from "@/domain/tonight";
import styles from "./ProviderTags.module.css";

interface ProviderTagsProps {
  providers: StreamingProvider[];
}

export function ProviderTags({ providers }: ProviderTagsProps) {
  if (providers.length === 0) {
    return (
      <span className={`${styles.tag} ${styles.off}`}>PAS EN STREAMING</span>
    );
  }
  return (
    <ul className={styles.list} aria-label="Plateformes">
      {/* One tag per platform, not per plan (« … with Ads »). */}
      {distinctPlatforms(providers).map((provider) => (
        <li key={provider.id} className={styles.tag}>
          {provider.name}
        </li>
      ))}
    </ul>
  );
}
