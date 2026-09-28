import Link from "next/link";

import { searchCategories, type SearchCategory } from "@/lib/domain/search";

import styles from "./category-nav.module.css";

export function CategoryNav({ category, query }: { category: SearchCategory; query: string }) {
  return (
    <nav className={styles.scroller} aria-label="Search categories">
      <div className={styles.list}>
        {searchCategories.map((item) => {
          const params = new URLSearchParams();
          if (query) params.set("q", query);
          params.set("type", item.value);
          const href = query ? `/search?${params.toString()}` : item.value === "all" ? "/" : `/search?${params.toString()}`;
          return (
            <Link
              className={styles.pill}
              data-active={category === item.value || undefined}
              aria-current={category === item.value ? "page" : undefined}
              href={href}
              key={item.value}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
