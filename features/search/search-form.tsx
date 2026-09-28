"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Icon } from "@/components/ui/icon";
import { parseSearchCategory } from "@/lib/domain/search";

import styles from "./search-form.module.css";

export function SearchForm() {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (document.activeElement === inputRef.current) return;
    setQuery(readUrlQuery());
  }, [pathname]);

  useEffect(() => {
    function syncFromHistory() {
      if (document.activeElement === inputRef.current) return;
      setQuery(readUrlQuery());
    }
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const normalized = normalizeQuery(query);
      if (!normalized) return;
      const nextCategory = parseSearchCategory(new URL(window.location.href).searchParams.get("type"));
      const currentQuery = readUrlQuery();
      if (normalized === currentQuery && window.location.pathname === "/search") return;
      const params = new URLSearchParams({ q: normalized, type: nextCategory });
      router.replace(`/search?${params.toString()}`, { scroll: false });
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [query, router]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    inputRef.current?.blur();
    const normalized = normalizeQuery(query);
    if (!normalized) {
      router.push("/", { scroll: false });
      return;
    }
    const nextCategory = parseSearchCategory(new URL(window.location.href).searchParams.get("type"));
    const params = new URLSearchParams({ q: normalized, type: nextCategory });
    router.push(`/search?${params.toString()}`, { scroll: false });
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
        ref={inputRef}
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

function readUrlQuery(): string {
  return (new URL(window.location.href).searchParams.get("q") ?? "").trim().slice(0, 200);
}

function normalizeQuery(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
}
