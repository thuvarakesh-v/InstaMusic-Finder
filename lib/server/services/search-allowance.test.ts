import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  DAILY_SEARCH_LIMIT,
  SEARCH_ALLOWANCE_NOTICE,
  formatSearchAllowance,
  nextLocalMidnight,
} from "@/lib/domain/search-allowance";
import { SearchAllowanceCodec } from "@/lib/server/services/search-allowance";

const SECRET = "test-only-secret-with-at-least-32-bytes";

describe("formatSearchAllowance", () => {
  it("uses the full-day copy at the daily limit", () => {
    expect(formatSearchAllowance(DAILY_SEARCH_LIMIT)).toBe("You can search 15 times a day. 15 remaining today.");
  });

  it("uses singular copy for one remaining search", () => {
    expect(formatSearchAllowance(1)).toBe("1 search remaining today.");
  });

  it("uses plural copy for other remaining counts", () => {
    expect(formatSearchAllowance(9)).toBe("9 searches remaining today.");
    expect(formatSearchAllowance(0)).toBe("0 searches remaining today.");
  });
});

describe("nextLocalMidnight", () => {
  it("returns the next UTC midnight", () => {
    const now = Date.UTC(2026, 0, 15, 15, 0, 0);
    expect(nextLocalMidnight(now, "UTC")).toBe(Date.UTC(2026, 0, 16, 0, 0, 0));
  });

  it("returns the following local midnight in America/New_York", () => {
    const now = Date.UTC(2026, 0, 15, 15, 0, 0);
    expect(nextLocalMidnight(now, "America/New_York")).toBe(Date.UTC(2026, 0, 16, 5, 0, 0));
  });

  it("stays on the next local midnight across the US spring-forward", () => {
    const now = Date.UTC(2026, 2, 8, 6, 30, 0);
    expect(nextLocalMidnight(now, "America/New_York")).toBe(Date.UTC(2026, 2, 9, 4, 0, 0));
  });

  it("moves to the following midnight when now is exactly local midnight", () => {
    const now = Date.UTC(2026, 0, 16, 5, 0, 0);
    expect(nextLocalMidnight(now, "America/New_York")).toBe(Date.UTC(2026, 0, 17, 5, 0, 0));
  });

  it("uses UTC when the timezone is missing or invalid", () => {
    const now = Date.UTC(2026, 0, 15, 15, 0, 0);
    expect(nextLocalMidnight(now, "Not/AZone")).toBe(Date.UTC(2026, 0, 16, 0, 0, 0));
  });
});

describe("SearchAllowanceCodec", () => {
  it("grants Spotify on a committed search and decrements the remaining count", () => {
    const codec = new SearchAllowanceCodec(SECRET, () => 1_000);
    const first = codec.decide({ cookie: undefined, query: "Fixture", commit: true, timeZone: "UTC" });
    expect(first.useSpotify).toBe(true);
    expect(first.searchesRemaining).toBe(14);
    expect(first.allowanceNotice).toBeNull();
    expect(first.payload.version).toBe(2);
    expect(first.payload.timeZone).toBe("UTC");
    expect(first.payload.resetsAt).toBe(Date.UTC(1970, 0, 2, 0, 0, 0));

    const followUp = codec.decide({ cookie: first.cookieValue, query: "Fixture", commit: false, timeZone: "UTC" });
    expect(followUp.useSpotify).toBe(true);
    expect(followUp.searchesRemaining).toBe(14);
  });

  it("does not spend another search for category or pagination of a granted query", () => {
    const codec = new SearchAllowanceCodec(SECRET, () => 1_000);
    const first = codec.decide({ cookie: undefined, query: "Fixture", commit: true, timeZone: "UTC" });
    const again = codec.decide({ cookie: first.cookieValue, query: "Fixture", commit: true, timeZone: "UTC" });
    expect(again.useSpotify).toBe(true);
    expect(again.searchesRemaining).toBe(14);
  });

  it("skips Spotify after fifteen commits and returns the allowance notice", () => {
    const codec = new SearchAllowanceCodec(SECRET, () => 1_000);
    let cookie: string | undefined;
    for (let index = 0; index < DAILY_SEARCH_LIMIT; index += 1) {
      const decision = codec.decide({ cookie, query: `Query ${index}`, commit: true, timeZone: "UTC" });
      expect(decision.useSpotify).toBe(true);
      cookie = decision.cookieValue;
    }

    const blocked = codec.decide({ cookie, query: "Overflow", commit: true, timeZone: "UTC" });
    expect(blocked.useSpotify).toBe(false);
    expect(blocked.searchesRemaining).toBe(0);
    expect(blocked.allowanceNotice).toBe(SEARCH_ALLOWANCE_NOTICE);
  });

  it("keeps the count until local midnight and then starts a fresh day", () => {
    let now = Date.UTC(2026, 0, 15, 15, 0, 0);
    const codec = new SearchAllowanceCodec(SECRET, () => now);
    const first = codec.decide({ cookie: undefined, query: "Fixture", commit: true, timeZone: "America/New_York" });
    expect(first.payload.resetsAt).toBe(Date.UTC(2026, 0, 16, 5, 0, 0));
    expect(first.searchesRemaining).toBe(14);

    now = first.payload.resetsAt - 1;
    const beforeMidnight = codec.decide({
      cookie: first.cookieValue,
      query: "Still today",
      commit: true,
      timeZone: "Asia/Colombo",
    });
    expect(beforeMidnight.useSpotify).toBe(true);
    expect(beforeMidnight.searchesRemaining).toBe(13);
    expect(beforeMidnight.payload.timeZone).toBe("America/New_York");
    expect(beforeMidnight.payload.resetsAt).toBe(first.payload.resetsAt);

    now = first.payload.resetsAt + 1;
    const next = codec.decide({ cookie: beforeMidnight.cookieValue, query: "Tomorrow", commit: true, timeZone: "America/New_York" });
    expect(next.useSpotify).toBe(true);
    expect(next.searchesRemaining).toBe(14);
    expect(next.payload.resetsAt).toBe(Date.UTC(2026, 0, 17, 5, 0, 0));
  });

  it("ignores a version 1 cookie and starts at a full allowance", () => {
    const codec = new SearchAllowanceCodec(SECRET, () => Date.UTC(2026, 0, 15, 15, 0, 0));
    const legacy = signLegacy({
      version: 1,
      used: 10,
      resetsAt: Date.UTC(2026, 0, 16, 15, 0, 0),
      granted: [],
    });
    const decision = codec.decide({ cookie: legacy, query: "Fresh", commit: true, timeZone: "UTC" });
    expect(decision.useSpotify).toBe(true);
    expect(decision.searchesRemaining).toBe(14);
    expect(decision.payload.version).toBe(2);
    expect(codec.remaining(legacy)).toBe(DAILY_SEARCH_LIMIT);
  });

  it("does not grant Spotify for a non-commit search of an ungranted query", () => {
    const codec = new SearchAllowanceCodec(SECRET, () => 1_000);
    const decision = codec.decide({ cookie: undefined, query: "Direct", commit: false, timeZone: "UTC" });
    expect(decision.useSpotify).toBe(false);
    expect(decision.searchesRemaining).toBe(15);
    expect(decision.allowanceNotice).toBeNull();
  });
});

function signLegacy(payload: unknown): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", SECRET).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}
