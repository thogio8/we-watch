import { Button } from "@/ui/Button";
import { ButtonLink } from "@/ui/ButtonLink";
import { cx } from "@/ui/cx";
import { Headline } from "@/ui/Headline";
import styles from "./DrawScreen.module.css";
import { DrawPile, type DrawPileProps } from "./DrawPile";
import { exhaustedText } from "./drawView";

interface DrawExhaustedProps {
  pile: DrawPileProps;
  eligibleCount: number;
  filtering: boolean;
  onResetPile: () => void;
  onClearFilters: () => void;
}

/** Every eligible movie is on the pile: start over, or widen the choice. */
export function DrawExhausted({
  pile,
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
      <DrawPile {...pile} />
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
