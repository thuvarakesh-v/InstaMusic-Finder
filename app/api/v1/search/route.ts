import { randomUUID } from "node:crypto";

import { z } from "zod";

import { searchCategorySchema } from "@/lib/domain/search";
import { readServerEnv } from "@/lib/server/env";
import { type ProviderError } from "@/lib/server/infra/provider-error";
import { createProviderRuntime } from "@/lib/server/providers/runtime";
import {
  CatalogSearchError,
  CatalogSearchService,
  normalizeCatalogSearchError,
} from "@/lib/server/services/catalog-search";
import { SearchCursorCodec } from "@/lib/server/services/search-cursor";

export const runtime = "nodejs";

const allowedParameters = new Set(["q", "type", "cursor", "limit"]);
const querySchema = z.object({
  q: z.string().min(1).max(200),
  type: searchCategorySchema.default("all"),
  cursor: z.string().max(2_048).nullable(),
  limit: z.number().int().min(1).max(10),
});

export async function GET(request: Request): Promise<Response> {
  const requestId = randomUUID();
  try {
    const url = new URL(request.url);
    for (const key of url.searchParams.keys()) {
      if (!allowedParameters.has(key) || url.searchParams.getAll(key).length !== 1) {
        throw new CatalogSearchError("INVALID_INPUT", `Unknown or repeated query parameter: ${key}`, 400);
      }
    }

    const typeResult = searchCategorySchema.safeParse(url.searchParams.get("type") ?? "all");
    if (!typeResult.success) throw new CatalogSearchError("INVALID_INPUT", "Unknown search category.", 400);
    const defaultLimit = typeResult.data === "all" ? 5 : 10;
    const limitText = url.searchParams.get("limit");
    if (limitText !== null && !/^\d+$/.test(limitText)) {
      throw new CatalogSearchError("INVALID_INPUT", "Search limit must be a whole number.", 400);
    }
    const parsed = querySchema.safeParse({
      q: url.searchParams.get("q")?.trim() ?? "",
      type: typeResult.data,
      cursor: url.searchParams.get("cursor"),
      limit: limitText === null ? defaultLimit : Number(limitText),
    });
    if (!parsed.success || (parsed.data.type === "all" && parsed.data.limit > 5)) {
      throw new CatalogSearchError("INVALID_INPUT", "Search parameters are out of range.", 400);
    }

    const env = readServerEnv();
    if (!env.CURSOR_SIGNING_SECRET) {
      throw new CatalogSearchError("INVALID_INPUT", "Server cursor signing is not configured.", 503);
    }
    const providers = await createProviderRuntime();
    const [clientLimit, aggregateLimit] = await Promise.all([
      providers.rateLimiter.consume("search:local-client", 30, 60),
      providers.rateLimiter.consume("search:aggregate", 120, 60),
    ]);
    if (!clientLimit.allowed || !aggregateLimit.allowed) {
      const retryAfterSeconds = Math.max(clientLimit.retryAfterSeconds, aggregateLimit.retryAfterSeconds);
      return errorResponse(requestId, "RATE_LIMITED", "Too many searches. Try again shortly.", 429, true, retryAfterSeconds);
    }

    const cursorCodec = new SearchCursorCodec(env.CURSOR_SIGNING_SECRET, {
      market: env.SPOTIFY_MARKET,
      mode: env.SPOTIFY_API_MODE,
    });
    const service = new CatalogSearchService(providers, cursorCodec);
    const result = await service.search({
      query: parsed.data.q,
      type: parsed.data.type,
      limit: parsed.data.limit,
      cursor: parsed.data.cursor,
    });

    return Response.json(
      {
        data: result.data,
        meta: { requestId, partial: result.partial, providers: result.providers },
      },
      {
        headers: {
          "Cache-Control": "private, max-age=30",
          "X-Request-ID": requestId,
        },
      },
    );
  } catch (unknownError) {
    const error = normalizeCatalogSearchError(unknownError);
    if (error instanceof CatalogSearchError) {
      return errorResponse(requestId, error.code, error.message, error.status, false, null);
    }
    return providerErrorResponse(requestId, error);
  }
}

function providerErrorResponse(requestId: string, error: ProviderError): Response {
  const mapping: Record<ProviderError["code"], { code: string; status: number; message: string }> = {
    NOT_CONFIGURED: { code: "NOT_CONFIGURED", status: 503, message: "Music search isn’t set up on this server yet." },
    INVALID_INPUT: { code: "INVALID_INPUT", status: 400, message: "That search isn’t valid. Try a track, artist, or album name." },
    PROVIDER_AUTH_FAILED: { code: "PROVIDER_UNAVAILABLE", status: 503, message: "Spotify couldn’t sign in. Try again in a moment." },
    PROVIDER_ACCESS_DENIED: { code: "SPOTIFY_ACCESS_DENIED", status: 403, message: "Spotify refused this request. Try again later." },
    PROVIDER_NOT_FOUND: { code: "ENTITY_NOT_FOUND", status: 404, message: "That item wasn’t found." },
    PROVIDER_RATE_LIMITED: { code: "PROVIDER_QUOTA_EXCEEDED", status: 429, message: "Spotify is limiting requests right now. Wait a moment and try again." },
    PROVIDER_INVALID_RESPONSE: { code: "PROVIDER_INVALID_RESPONSE", status: 502, message: "Spotify sent a response this app couldn’t read. Try again." },
    PROVIDER_UNAVAILABLE: { code: "PROVIDER_UNAVAILABLE", status: 503, message: "Music search is unavailable right now. Try again in a moment." },
    PROVIDER_TIMEOUT: { code: "LOOKUP_TIMEOUT", status: 504, message: "Music search took too long. Try again." },
    QUEUE_SATURATED: { code: "PROVIDER_UNAVAILABLE", status: 503, message: "Music search is busy. Wait a moment and try again." },
    INFRASTRUCTURE_UNAVAILABLE: { code: "INFRASTRUCTURE_UNAVAILABLE", status: 503, message: "Search is unavailable right now. Try again in a moment." },
  };
  const mapped = mapping[error.code];
  return errorResponse(requestId, mapped.code, mapped.message, mapped.status, error.retryable, error.retryAfterSeconds);
}

function errorResponse(
  requestId: string,
  code: string,
  message: string,
  status: number,
  retryable: boolean,
  retryAfterSeconds: number | null,
): Response {
  const headers = new Headers({ "Cache-Control": "no-store", "X-Request-ID": requestId });
  if (retryAfterSeconds !== null) headers.set("Retry-After", String(retryAfterSeconds));
  return Response.json(
    { error: { code, message, retryable, retryAfterSeconds }, meta: { requestId } },
    { status, headers },
  );
}
