import { parseSearchCategory } from "@/lib/domain/search";
import { SearchScreen } from "@/features/search/search-screen";

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const queryValue = Array.isArray(params.q) ? params.q[0] : params.q;
  const typeValue = Array.isArray(params.type) ? params.type[0] : params.type;
  const query = queryValue?.trim().slice(0, 200) ?? "";
  const category = parseSearchCategory(typeValue);

  return <SearchScreen category={category} query={query} />;
}
