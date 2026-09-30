import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import {
  DAILY_SEARCH_LIMIT,
  SEARCH_ALLOWANCE_NOTICE,
  formatSearchAllowance,
  nextLocalMidnight,
  resolveTimeZone,
} from "@/lib/domain/search-allowance";

export const SEARCH_ALLOWANCE_COOKIE = "instamusic_search_allowance";

const allowancePayloadSchema = z.object({
  version: z.literal(2),
  used: z.number().int().nonnegative().max(DAILY_SEARCH_LIMIT),
  resetsAt: z.number().int().positive(),
  timeZone: z.string().min(1).max(64),
  granted: z.array(z.string().length(64)).max(DAILY_SEARCH_LIMIT),
});

export type SearchAllowancePayload = z.infer<typeof allowancePayloadSchema>;

export type SearchAllowanceDecision = {
  useSpotify: boolean;
  allowanceNotice: string | null;
  searchesRemaining: number;
  cookieValue: string;
  payload: SearchAllowancePayload;
};

export class SearchAllowanceCodec {
  constructor(
    private readonly secret: string,
    private readonly now: () => number = Date.now,
  ) {
    if (Buffer.byteLength(secret) < 32) throw new Error("CURSOR_SIGNING_SECRET must contain at least 32 bytes.");
  }

  read(raw: string | undefined): SearchAllowancePayload {
    const empty = this.empty();
    if (!raw) return empty;
    const [encoded, signature, extra] = raw.split(".");
    if (!encoded || !signature || extra) return empty;
    const expectedSignature = this.sign(encoded);
    const actualBytes = Buffer.from(signature);
    const expectedBytes = Buffer.from(expectedSignature);
    if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) return empty;

    let unknownPayload: unknown;
    try {
      unknownPayload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as unknown;
    } catch {
      return empty;
    }
    const parsed = allowancePayloadSchema.safeParse(unknownPayload);
    if (!parsed.success) return empty;
    if (parsed.data.resetsAt <= this.now()) return empty;
    return parsed.data;
  }

  encode(payload: SearchAllowancePayload): string {
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${encoded}.${this.sign(encoded)}`;
  }

  decide(input: {
    cookie: string | undefined;
    query: string;
    commit: boolean;
    timeZone?: string | null;
  }): SearchAllowanceDecision {
    let payload = this.read(input.cookie);
    const queryHash = fingerprint(input.query);
    const alreadyGranted = payload.granted.includes(queryHash);

    if (input.commit && !alreadyGranted && payload.used < DAILY_SEARCH_LIMIT) {
      if (payload.used === 0) {
        const timeZone = resolveTimeZone(input.timeZone);
        payload = {
          version: 2,
          used: 0,
          resetsAt: nextLocalMidnight(this.now(), timeZone),
          timeZone,
          granted: [],
        };
      }
      payload = {
        ...payload,
        used: payload.used + 1,
        granted: [...payload.granted, queryHash].slice(0, DAILY_SEARCH_LIMIT),
      };
    }

    const granted = payload.granted.includes(queryHash);
    const useSpotify = granted;
    const searchesRemaining = Math.max(0, DAILY_SEARCH_LIMIT - payload.used);
    return {
      useSpotify,
      allowanceNotice: !useSpotify && payload.used >= DAILY_SEARCH_LIMIT ? SEARCH_ALLOWANCE_NOTICE : null,
      searchesRemaining,
      cookieValue: this.encode(payload),
      payload,
    };
  }

  remaining(cookie: string | undefined): number {
    const payload = this.read(cookie);
    return Math.max(0, DAILY_SEARCH_LIMIT - payload.used);
  }

  empty(timeZone?: string | null): SearchAllowancePayload {
    const zone = resolveTimeZone(timeZone);
    return {
      version: 2,
      used: 0,
      resetsAt: nextLocalMidnight(this.now(), zone),
      timeZone: zone,
      granted: [],
    };
  }

  private sign(encoded: string): string {
    return createHmac("sha256", this.secret).update(encoded).digest("base64url");
  }
}

export function searchAllowanceCookieHeader(value: string, maxAgeSeconds: number): string {
  const parts = [
    `${SEARCH_ALLOWANCE_COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(1, maxAgeSeconds)}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export { formatSearchAllowance, SEARCH_ALLOWANCE_NOTICE };

function fingerprint(query: string): string {
  return createHash("sha256").update(query.normalize("NFC").toLocaleLowerCase("en-US")).digest("hex");
}
