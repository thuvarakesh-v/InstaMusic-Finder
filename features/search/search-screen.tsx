import type { SearchCategory } from "@/lib/domain/search";

import { CategoryNav } from "./category-nav";
import { RecentSaves } from "./recent-saves";
import { SearchForm } from "./search-form";
import { SearchResults } from "./search-results";
import styles from "./search-screen.module.css";

export function SearchScreen({ query, category }: { query: string; category: SearchCategory }) {
  return (
    <div className={styles.screen}>
      <header className={styles.hero}>
        <h1>{query ? `Results for “${query}”` : "Find the code behind the track."}</h1>
        {query ? null : (
          <p className={styles.instruction}>
            Find your track, copy the code, then paste it into Instagram Music search.
          </p>
        )}
      </header>

      <SearchForm key={`${category}:${query}`} initialQuery={query} category={category} />
      {query ? <CategoryNav category={category} query={query} /> : <RecentSaves />}
      {query ? <SearchResults category={category} query={query} /> : null}
    </div>
  );
}
