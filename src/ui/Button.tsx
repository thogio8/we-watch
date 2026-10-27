import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";
import { cx } from "./cx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: "primary" | "love" | "secondary";
  children: ReactNode;
}

export function Button({
  variant,
  children,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = cx(styles.button, styles[variant], className);
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
