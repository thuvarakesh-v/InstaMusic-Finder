import { describe, expect, it } from "vitest";

import { DAILY_SEARCH_LIMIT } from "./search-allowance";
import { searchAllowanceApiResponseSchema, searchApiResponseSchema } from "./search-contract";

const searchPayload = {
  data: {
    query: "Fixture",
    type: "all",
    sections: {
      songs: { items: [], limit: 5, nextCursor: null, state: "ok", message: null },
      albums: { items: [], limit: 5, nextCursor: null, state: "ok", message: null },
    },
  },
  meta: {
    requestId: "fixture-request",
    partial: false,
    providers: { spotify: "ok", musicbrainz: "ok" },
    searchesRemaining: DAILY_SEARCH_LIMIT,
    allowanceNotice: null,
  },
};

describe("search response contracts", () => {
  it("accepts a full daily allowance on a search response", () => {
    expect(searchApiResponseSchema.safeParse(searchPayload).success).toBe(true);
  });

  it("rejects a search response above the daily allowance", () => {
    const overLimit = { ...searchPayload, meta: { ...searchPayload.meta, searchesRemaining: DAILY_SEARCH_LIMIT + 1 } };
    expect(searchApiResponseSchema.safeParse(overLimit).success).toBe(false);
  });

  it("accepts a full daily allowance on the allowance response", () => {
    const parsed = searchAllowanceApiResponseSchema.safeParse({
      data: { searchesRemaining: DAILY_SEARCH_LIMIT, message: "You can search 15 times a day. 15 remaining today." },
      meta: { requestId: "allowance-request" },
    });
    expect(parsed.success).toBe(true);
  });
});
