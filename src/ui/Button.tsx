import type { ComponentPropsWithRef, ReactNode } from "react";
import styles from "./Button.module.css";
import { cx } from "./cx";

/** A ref reaches the <button> (React 19: a plain prop), e.g. to move focus. */
interface ButtonProps extends ComponentPropsWithRef<"button"> {
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
