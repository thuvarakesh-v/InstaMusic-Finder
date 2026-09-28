"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandMark } from "@/components/brand-mark";
import { Icon, type IconName } from "@/components/ui/icon";

import styles from "./app-nav.module.css";
import { ThemeToggle } from "./theme-toggle";

const COFFEE_URL = "https://buymeacoffee.com/thuvarakesh";

const links: ReadonlyArray<{ href: string; label: string; icon: IconName; match: (path: string) => boolean }> = [
  { href: "/", label: "Search", icon: "search", match: (path) => path === "/" || path.startsWith("/search") || path.startsWith("/albums/") },
  { href: "/saved", label: "Saved", icon: "bookmark", match: (path) => path.startsWith("/saved") },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <header className={styles.header}>
      <div className={styles.topBar}>
        <Link className={styles.brandLink} href="/" aria-label="InstaMusic Finder home">
          <BrandMark />
        </Link>
        <div className={styles.actions}>
          <a
            className={styles.coffee}
            href={COFFEE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Buy me a coffee"
          >
            <Icon name="coffee" width="16" height="16" />
            <span className={styles.coffeeFull}>Buy me a coffee</span>
            <span className={styles.coffeeShort}>Coffee</span>
          </a>
          <ThemeToggle />
        </div>
      </div>
      <nav className={styles.nav} aria-label="Primary navigation">
        {links.map((link) => {
          const active = link.match(pathname);
          return (
            <Link
              className={styles.link}
              data-active={active || undefined}
              href={link.href}
              key={link.href}
              aria-current={active ? "page" : undefined}
            >
              <Icon name={link.icon} width="21" height="21" />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
