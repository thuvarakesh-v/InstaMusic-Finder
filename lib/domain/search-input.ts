import { normalizeIsrc } from "./isrc";

export const NAME_ONLY_SEARCH_MESSAGE = "Search for a track, artist, or album name.";

export type ClassifiedSearchInput =
  | { kind: "text"; value: string }
  | { kind: "unsupported"; value: string };

export class SearchInputError extends Error {
  constructor(readonly code: "INVALID_INPUT" | "UNSUPPORTED_INPUT", message: string) {
    super(message);
    this.name = "SearchInputError";
  }
}

export function classifySearchInput(input: string): ClassifiedSearchInput {
  const value = normalizeSearchText(input);
  if (!value) throw new SearchInputError("INVALID_INPUT", "Enter a search term.");
  if (value.length > 200) throw new SearchInputError("INVALID_INPUT", "Search terms can contain at most 200 characters.");

  if (isRejectedCatalogQuery(value)) {
    return { kind: "unsupported", value };
  }
  return { kind: "text", value };
}

export function isRejectedCatalogQuery(value: string): boolean {
  const normalized = normalizeSearchText(value);
  if (!normalized) return false;
  if (/^isrc:/i.test(normalized)) return true;
  if (normalizeIsrc(normalized)) return true;
  if (/^https?:\/\//i.test(normalized)) return true;
  if (/^spotify:/i.test(normalized)) return true;
  return false;
}

export function normalizeSearchText(input: string): string {
  return input.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}
