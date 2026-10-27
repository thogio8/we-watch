import type { ReactNode } from "react";
import styles from "./Stamp.module.css";

interface StampProps {
  children: ReactNode;
  tone: "paper" | "yellow";
  /** Rotation in degrees. */
  tilt: number;
  className?: string;
}

export function Stamp({ children, tone, tilt, className }: StampProps) {
  const classes = [styles.stamp, styles[tone], className]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={classes} style={{ transform: `rotate(${tilt}deg)` }}>
      {children}
    </span>
  );
}
