"use client";

import { Suspense, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { SearchForm } from "./search-form";
import styles from "./search-screen.module.css";

export function CatalogChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname !== "/" && pathname !== "/search") return children;

  return (
    <div className={styles.screen}>
      <Suspense fallback={<CatalogHeading query="" />}>
        <CatalogHeadingFromUrl />
      </Suspense>
      <SearchForm />
      {children}
    </div>
  );
}

function CatalogHeadingFromUrl() {
  const searchParams = useSearchParams();
  const query = (searchParams.get("q") ?? "").trim().slice(0, 200);
  return <CatalogHeading query={query} />;
}

function CatalogHeading({ query }: { query: string }) {
  return (
    <header className={styles.hero}>
      <h1>{query ? `Results for “${query}”` : "Find the code behind the track."}</h1>
      {query ? null : (
        <p className={styles.instruction}>
          Find your track, copy the code, then paste it into Instagram Music search.
        </p>
      )}
    </header>
  );
}
