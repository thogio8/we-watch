import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./Button.module.css";

interface ButtonLinkProps {
  href: string;
  variant: "primary" | "love" | "secondary";
  children: ReactNode;
}

/** Navigation styled as a Button (e.g. « ALLER SWIPER »). */
export function ButtonLink({ href, variant, children }: ButtonLinkProps) {
  return (
    <Link href={href} className={`${styles.button} ${styles[variant]}`}>
      {children}
    </Link>
  );
}
