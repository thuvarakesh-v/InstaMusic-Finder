import { z } from "zod";

export const searchCategorySchema = z.enum(["all", "song", "album"]);
export type SearchCategory = z.infer<typeof searchCategorySchema>;

export const searchCategories: ReadonlyArray<{ value: SearchCategory; label: string }> = [
  { value: "all", label: "All" },
  { value: "song", label: "Songs" },
  { value: "album", label: "Albums" },
];

export function parseSearchCategory(value: unknown): SearchCategory {
  const result = searchCategorySchema.safeParse(value);
  return result.success ? result.data : "all";
}
