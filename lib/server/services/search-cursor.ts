import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { searchCategorySchema, type SearchCategory } from "@/lib/domain/search";

const cursorPayloadSchema = z.object({
  version: z.literal(1),
  queryHash: z.string().length(64),
  type: searchCategorySchema.exclude(["all"]),
  spotifyOffset: z.number().int().nonnegative().max(1_000),
  musicbrainzOffset: z.number().int().nonnegative().max(100_000),
  market: z.string().regex(/^[A-Z]{2}$/),
  mode: z.enum(["development", "extended"]),
  expiresAt: z.number().int().positive(),
});

type CursorPayload = z.infer<typeof cursorPayloadSchema>;

export class SearchCursorError extends Error {
  constructor(message = "This results page has expired. Start the search again.") {
    super(message);
    this.name = "SearchCursorError";
  }
}

export class SearchCursorCodec {
  constructor(
    private readonly secret: string,
    private readonly context: { market: string; mode: "development" | "extended" },
    private readonly now: () => number = Date.now,
  ) {
    if (Buffer.byteLength(secret) < 32) throw new Error("CURSOR_SIGNING_SECRET must contain at least 32 bytes.");
  }

  encode(input: {
    query: string;
    type: Exclude<SearchCategory, "all">;
    spotifyOffset: number;
    musicbrainzOffset: number;
  }): string {
    const payload: CursorPayload = {
      version: 1,
      queryHash: fingerprint(input.query),
      type: input.type,
      spotifyOffset: input.spotifyOffset,
      musicbrainzOffset: input.musicbrainzOffset,
      market: this.context.market,
      mode: this.context.mode,
      expiresAt: this.now() + 15 * 60_000,
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${encoded}.${this.sign(encoded)}`;
  }

  decode(token: string, expected: { query: string; type: Exclude<SearchCategory, "all"> }): CursorPayload {
    if (token.length > 2_048) throw new SearchCursorError("The results cursor is too long.");
    const [encoded, signature, extra] = token.split(".");
    if (!encoded || !signature || extra) throw new SearchCursorError();
    const expectedSignature = this.sign(encoded);
    const actualBytes = Buffer.from(signature);
    const expectedBytes = Buffer.from(expectedSignature);
    if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) throw new SearchCursorError();

    let unknownPayload: unknown;
    try {
      unknownPayload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as unknown;
    } catch {
      throw new SearchCursorError();
    }
    const parsed = cursorPayloadSchema.safeParse(unknownPayload);
    if (!parsed.success) throw new SearchCursorError();
    const payload = parsed.data;
    if (
      payload.expiresAt <= this.now() ||
      payload.queryHash !== fingerprint(expected.query) ||
      payload.type !== expected.type ||
      payload.market !== this.context.market ||
      payload.mode !== this.context.mode
    ) {
      throw new SearchCursorError();
    }
    return payload;
  }

  private sign(encoded: string): string {
    return createHmac("sha256", this.secret).update(encoded).digest("base64url");
  }
}

function fingerprint(query: string): string {
  return createHash("sha256").update(query.normalize("NFC").toLocaleLowerCase("en-US")).digest("hex");
}
