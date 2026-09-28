import { randomUUID } from "node:crypto";

import { ProviderError, type ProviderErrorCode } from "@/lib/server/infra/provider-error";
import { createProviderRuntime } from "@/lib/server/providers/runtime";
import { AlbumDetailService } from "@/lib/server/services/album-detail";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const requestId = randomUUID();
  try {
    const url = new URL(request.url);
    if ([...url.searchParams].length > 0) return errorResponse(requestId, "INVALID_INPUT", "This album address has extra parameters this app doesn’t use.", 400, false);
    const { id } = await context.params;
    if (!/^[A-Za-z0-9]{22}$/.test(id)) return errorResponse(requestId, "INVALID_INPUT", "That album address isn’t valid.", 400, false);

    const providers = await createProviderRuntime();
    const limit = await providers.rateLimiter.consume("album:local-client", 20, 60);
    if (!limit.allowed) return errorResponse(requestId, "RATE_LIMITED", "Too many album requests. Wait a moment and try again.", 429, true, limit.retryAfterSeconds);

    const result = await new AlbumDetailService(providers.spotify).get(id);
    return Response.json(
      {
        data: { album: result.album, tracks: result.tracks },
        meta: {
          requestId,
          partial: result.partial,
          providers: { spotify: result.partial ? "unavailable" : "ok", musicbrainz: "skipped" },
        },
      },
      { headers: { "Cache-Control": "private, max-age=30", "X-Request-ID": requestId } },
    );
  } catch (error) {
    if (error instanceof ProviderError) {
      const status = error.code === "PROVIDER_RATE_LIMITED" ? 429 : error.status;
      return errorResponse(requestId, error.code, albumErrorMessage(error.code), status, error.retryable, error.retryAfterSeconds);
    }
    return errorResponse(requestId, "PROVIDER_UNAVAILABLE", "These album tracks didn’t load. Try again.", 503, true);
  }
}

function albumErrorMessage(code: ProviderErrorCode): string {
  switch (code) {
    case "PROVIDER_NOT_FOUND":
      return "Spotify couldn’t find this album.";
    case "PROVIDER_RATE_LIMITED":
      return "Spotify is limiting requests right now. Wait a moment and try again.";
    case "PROVIDER_TIMEOUT":
      return "Spotify took too long to answer. Try again.";
    case "NOT_CONFIGURED":
      return "Music search isn’t set up on this server yet.";
    case "PROVIDER_AUTH_FAILED":
      return "Spotify couldn’t sign in. Try again in a moment.";
    default:
      return "These album tracks didn’t load. Try again.";
  }
}

function errorResponse(
  requestId: string,
  code: string,
  message: string,
  status: number,
  retryable: boolean,
  retryAfterSeconds: number | null = null,
) {
  const headers = new Headers({ "Cache-Control": "no-store", "X-Request-ID": requestId });
  if (retryAfterSeconds !== null) headers.set("Retry-After", String(retryAfterSeconds));
  return Response.json({ error: { code, message, retryable, retryAfterSeconds }, meta: { requestId } }, { status, headers });
}
