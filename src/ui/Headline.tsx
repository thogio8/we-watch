import styles from "./Headline.module.css";
import { cx } from "./cx";
import { Lines } from "./Lines";

interface HeadlineProps {
  lines: readonly string[];
  as?: "h1" | "h2";
  size?: "large" | "medium";
  className?: string;
}

/** A screen title (« CE SOIR ON REGARDE »), one display line per entry. */
export function Headline({
  lines,
  as: Tag = "h1",
  size = "large",
  className,
}: HeadlineProps) {
  return (
    <Tag className={cx(styles.headline, styles[size], className)}>
      <Lines lines={lines} />
    </Tag>
  );
}
