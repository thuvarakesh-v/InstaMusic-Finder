export const SEARCH_COMMIT_STORAGE_KEY = "instamusic-search-commit";

export function takeSearchCommit(query: string): boolean {
  try {
    const pending = window.sessionStorage.getItem(SEARCH_COMMIT_STORAGE_KEY);
    if (pending !== query) return false;
    window.sessionStorage.removeItem(SEARCH_COMMIT_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
