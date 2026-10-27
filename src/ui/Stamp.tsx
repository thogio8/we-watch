import type { ReactNode } from "react";
import styles from "./Stamp.module.css";
import { cx } from "./cx";

interface StampProps {
  children: ReactNode;
  tone: "paper" | "yellow";
  /** Rotation in degrees. */
  tilt: number;
  className?: string;
}

export function Stamp({ children, tone, tilt, className }: StampProps) {
  const classes = cx(styles.stamp, styles[tone], className);
  return (
    <span className={classes} style={{ transform: `rotate(${tilt}deg)` }}>
      {children}
    </span>
  );
}
