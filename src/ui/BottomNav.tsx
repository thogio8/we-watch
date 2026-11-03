"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { INVITATION_PREFIX, SIGNIN_PATH } from "@/access/paths";
import styles from "./BottomNav.module.css";
import { cx } from "./cx";

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

/** The three tabs; `pathname` null: none is current yet. */
function NavTabs({ pathname }: { pathname: string | null }) {
  return (
    <nav className={styles.nav} aria-label="Navigation principale">
      {TABS.map((tab) => {
        const active = pathname !== null && isActive(pathname, tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cx(styles.tab, active && styles.on)}
            aria-current={active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  // The app stays hidden until someone signs in, or goes in from an invite link.
  if (pathname === SIGNIN_PATH || pathname.startsWith(INVITATION_PREFIX)) {
    return null;
  }
  return <NavTabs pathname={pathname} />;
}

/**
 * While a dynamic route (a movie page) streams in, its URL is not known yet:
 * the same tabs, none current, so nothing moves.
 */
export function BottomNavFallback() {
  return <NavTabs pathname={null} />;
}
