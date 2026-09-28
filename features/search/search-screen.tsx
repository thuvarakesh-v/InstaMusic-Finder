import type { SearchCategory } from "@/lib/domain/search";

import { CategoryNav } from "./category-nav";
import { RecentSaves } from "./recent-saves";
import { SearchResults } from "./search-results";

export function SearchScreen({ query, category }: { query: string; category: SearchCategory }) {
  if (!query) return <RecentSaves />;
  return (
    <>
      <CategoryNav category={category} query={query} />
      <SearchResults category={category} query={query} />
    </>
  );
}
