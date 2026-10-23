import { Fragment } from "react";
import styles from "./Lines.module.css";

/** A display title broken into lines, read as one sentence by screen readers. */
export function Lines({ lines }: { lines: readonly string[] }) {
  return lines.map((line, index) => (
    <Fragment key={line}>
      {index > 0 && " "}
      <span className={styles.line}>{line}</span>
    </Fragment>
  ));
}
