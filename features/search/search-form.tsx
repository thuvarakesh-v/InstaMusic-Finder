"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "@/components/ui/icon";
import type { SearchCategory } from "@/lib/domain/search";

import styles from "./search-form.module.css";

export function SearchForm({ initialQuery, category }: { initialQuery: string; category: SearchCategory }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const normalized = normalizeQuery(query);
    if (!normalized || normalized === initialQuery) return;
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams({ q: normalized, type: category });
      router.replace(`/search?${params.toString()}`);
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [category, initialQuery, query, router]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeQuery(query);
    if (!normalized) {
      router.push("/");
      return;
    }
    const params = new URLSearchParams({ q: normalized, type: category });
    router.push(`/search?${params.toString()}`);
  }

  return (
    <form className={styles.form} role="search" onSubmit={handleSubmit}>
      <Icon className={styles.icon} name="search" width="21" height="21" />
      <label className={styles.label} htmlFor="catalog-search">Search music</label>
      <input
        className={styles.input}
        id="catalog-search"
        name="q"
        type="search"
        value={query}
        maxLength={200}
        placeholder="Track, artist, or album"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => setQuery(event.target.value)}
      />
      <button className={styles.submit} type="submit" aria-label="Search music">
        <span>Search</span>
        <Icon name="arrow" width="18" height="18" />
      </button>
    </form>
  );
}

function normalizeQuery(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
}
