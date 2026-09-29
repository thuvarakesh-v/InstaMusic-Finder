import { describe, expect, it } from "vitest";

import { DAILY_SEARCH_LIMIT, SEARCH_ALLOWANCE_NOTICE, formatSearchAllowance } from "@/lib/domain/search-allowance";
import { SearchAllowanceCodec } from "@/lib/server/services/search-allowance";

const SECRET = "test-only-secret-with-at-least-32-bytes";

describe("formatSearchAllowance", () => {
  it("uses the full-day copy at the daily limit", () => {
    expect(formatSearchAllowance(DAILY_SEARCH_LIMIT)).toBe("You can search 10 times a day. 10 remaining today.");
  });

  it("uses singular copy for one remaining search", () => {
    expect(formatSearchAllowance(1)).toBe("1 search remaining today.");
  });

  it("uses plural copy for other remaining counts", () => {
    expect(formatSearchAllowance(9)).toBe("9 searches remaining today.");
    expect(formatSearchAllowance(0)).toBe("0 searches remaining today.");
  });
});

describe("SearchAllowanceCodec", () => {
  it("grants Spotify on a committed search and decrements the remaining count", () => {
    const codec = new SearchAllowanceCodec(SECRET, () => 1_000);
    const first = codec.decide({ cookie: undefined, query: "Fixture", commit: true });
    expect(first.useSpotify).toBe(true);
    expect(first.searchesRemaining).toBe(9);
    expect(first.allowanceNotice).toBeNull();

    const followUp = codec.decide({ cookie: first.cookieValue, query: "Fixture", commit: false });
    expect(followUp.useSpotify).toBe(true);
    expect(followUp.searchesRemaining).toBe(9);
  });

  it("does not spend another search for category or pagination of a granted query", () => {
    const codec = new SearchAllowanceCodec(SECRET, () => 1_000);
    const first = codec.decide({ cookie: undefined, query: "Fixture", commit: true });
    const again = codec.decide({ cookie: first.cookieValue, query: "Fixture", commit: true });
    expect(again.useSpotify).toBe(true);
    expect(again.searchesRemaining).toBe(9);
  });

  it("skips Spotify after ten commits and returns the allowance notice", () => {
    const codec = new SearchAllowanceCodec(SECRET, () => 1_000);
    let cookie: string | undefined;
    for (let index = 0; index < DAILY_SEARCH_LIMIT; index += 1) {
      const decision = codec.decide({ cookie, query: `Query ${index}`, commit: true });
      expect(decision.useSpotify).toBe(true);
      cookie = decision.cookieValue;
    }

    const blocked = codec.decide({ cookie, query: "Overflow", commit: true });
    expect(blocked.useSpotify).toBe(false);
    expect(blocked.searchesRemaining).toBe(0);
    expect(blocked.allowanceNotice).toBe(SEARCH_ALLOWANCE_NOTICE);
  });

  it("resets the window after 24 hours", () => {
    let now = 1_000;
    const codec = new SearchAllowanceCodec(SECRET, () => now);
    const first = codec.decide({ cookie: undefined, query: "Fixture", commit: true });
    now = first.payload.resetsAt + 1;
    const next = codec.decide({ cookie: first.cookieValue, query: "Later", commit: true });
    expect(next.useSpotify).toBe(true);
    expect(next.searchesRemaining).toBe(9);
  });

  it("does not grant Spotify for a non-commit search of an ungranted query", () => {
    const codec = new SearchAllowanceCodec(SECRET, () => 1_000);
    const decision = codec.decide({ cookie: undefined, query: "Direct", commit: false });
    expect(decision.useSpotify).toBe(false);
    expect(decision.searchesRemaining).toBe(10);
    expect(decision.allowanceNotice).toBeNull();
  });
});
