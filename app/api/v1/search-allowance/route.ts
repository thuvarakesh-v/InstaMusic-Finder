import { randomUUID } from "node:crypto";

import { formatSearchAllowance } from "@/lib/domain/search-allowance";
import { readServerEnv } from "@/lib/server/env";
import {
  SEARCH_ALLOWANCE_COOKIE,
  SearchAllowanceCodec,
} from "@/lib/server/services/search-allowance";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const requestId = randomUUID();
  const env = readServerEnv();
  if (!env.CURSOR_SIGNING_SECRET) {
    return Response.json(
      {
        error: {
          code: "NOT_CONFIGURED",
          message: "Search allowance isn’t set up on this server yet.",
          retryable: false,
          retryAfterSeconds: null,
        },
        meta: { requestId },
      },
      { status: 503, headers: { "Cache-Control": "no-store", "X-Request-ID": requestId } },
    );
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const rawAllowance = readCookie(cookieHeader, SEARCH_ALLOWANCE_COOKIE);
  const remaining = new SearchAllowanceCodec(env.CURSOR_SIGNING_SECRET).remaining(rawAllowance);
  return Response.json(
    {
      data: {
        searchesRemaining: remaining,
        message: formatSearchAllowance(remaining),
      },
      meta: { requestId },
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Request-ID": requestId,
      },
    },
  );
}

function readCookie(header: string, name: string): string | undefined {
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    if (trimmed.slice(0, separator) !== name) continue;
    return trimmed.slice(separator + 1);
  }
  return undefined;
}
