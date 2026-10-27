import { Button } from "@/ui/Button";
import { ButtonLink } from "@/ui/ButtonLink";
import { cx } from "@/ui/cx";
import { Headline } from "@/ui/Headline";
import { TornPile } from "@/ui/TornPile";
import styles from "./DrawScreen.module.css";
import { exhaustedText } from "./drawView";

interface DrawExhaustedProps {
  pileCount: number;
  eligibleCount: number;
  filtering: boolean;
  onResetPile: () => void;
  onClearFilters: () => void;
}

/** Every eligible movie is on the pile: start over, or widen the choice. */
export function DrawExhausted({
  pileCount,
  eligibleCount,
  filtering,
  onResetPile,
  onClearFilters,
}: DrawExhaustedProps) {
  return (
    <>
      <Headline
        lines={["VOUS ÊTES", "DIFFICILES", "CE SOIR"]}
        className={styles.dropped}
      />
      <TornPile count={pileCount} label="PAS CE SOIR" />
      <p className={styles.small}>{exhaustedText(eligibleCount, filtering)}</p>
      <div className={cx(styles.actions, styles.spaced)}>
        <Button variant="primary" onClick={onResetPile}>
          ON REMET TOUT
        </Button>
      </div>
      <p className={cx(styles.small, styles.or)}>ou</p>
      <div className={styles.actions}>
        {filtering ? (
          <Button variant="secondary" onClick={onClearFilters}>
            ENLEVER LES FILTRES
          </Button>
        ) : (
          <ButtonLink href="/swipe" variant="secondary">
            ALLER SWIPER
          </ButtonLink>
        )}
      </div>
    </>
  );
}
