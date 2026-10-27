import { ButtonLink } from "@/ui/ButtonLink";
import { cx } from "@/ui/cx";
import { Headline } from "@/ui/Headline";
import styles from "./DrawScreen.module.css";

/** The « à voir » list is empty: nothing to draw, go swipe. */
export function DrawEmpty() {
  return (
    <>
      <Headline
        lines={["RIEN", "À TIRER", "CE SOIR"]}
        className={styles.dropped}
      />
      <p className={cx(styles.small, styles.emptyText)}>
        La liste « à voir » est vide : swipez quelques films d’abord
      </p>
      <div className={cx(styles.actions, styles.spaced)}>
        <ButtonLink href="/swipe" variant="primary">
          ALLER SWIPER
        </ButtonLink>
      </div>
    </>
  );
}
