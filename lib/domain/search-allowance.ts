export const DAILY_SEARCH_LIMIT = 10;
export const SEARCH_ALLOWANCE_WINDOW_MS = 24 * 60 * 60 * 1_000;
export const SEARCH_ALLOWANCE_NOTICE = "For more relevant results, try again in 24 hours.";

export function formatSearchAllowance(remaining: number): string {
  const safe = Math.max(0, Math.min(DAILY_SEARCH_LIMIT, Math.trunc(remaining)));
  if (safe === DAILY_SEARCH_LIMIT) return `You can search ${DAILY_SEARCH_LIMIT} times a day. ${DAILY_SEARCH_LIMIT} remaining today.`;
  if (safe === 1) return "1 search remaining today.";
  return `${safe} searches remaining today.`;
}
