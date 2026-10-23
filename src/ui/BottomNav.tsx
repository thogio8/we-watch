"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UNLOCK_PATH } from "@/access/paths";
import styles from "./BottomNav.module.css";

const TABS = [
  { href: "/", label: "TIRER" },
  { href: "/swipe", label: "SWIPER" },
  { href: "/list", label: "LISTE" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();
  // The app stays hidden until the device is unlocked.
  if (pathname === UNLOCK_PATH) {
    return null;
  }
  return (
    <nav className={styles.nav} aria-label="Navigation principale">
      {TABS.map((tab) => {
        const active = isActive(pathname, tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={active ? `${styles.tab} ${styles.on}` : styles.tab}
            aria-current={active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
