import { z, type ZodType } from "zod";

import type { Album, Artist, CatalogSearchResult, Page, ProviderRef, Song } from "@/lib/domain/catalog";
import { normalizeIsrc } from "@/lib/domain/isrc";
import type { CacheStore } from "@/lib/server/infra/cache";
import { fetchJson } from "@/lib/server/infra/http";
import { isProviderError, ProviderError } from "@/lib/server/infra/provider-error";

import {
  cachedSpotifyTokenSchema,
  spotifyAlbumSchema,
  spotifyAlbumTracksSchema,
  spotifyArtistAlbumsSchema,
  spotifyArtistSchema,
  spotifySearchResponseSchema,
  spotifyTokenResponseSchema,
  spotifyTrackSchema,
  type SpotifyAlbumPayload,
  type SpotifyArtistPayload,
  type SpotifyTrackPayload,
} from "./spotify-schemas";

const SPOTIFY_API = "https://api.spotify.com/v1";
const SPOTIFY_TOKEN_URL = new URL("https://accounts.spotify.com/api/token");
const searchTypes = ["track", "album", "artist"] as const;
export type SpotifySearchType = (typeof searchTypes)[number];

type SpotifyConfig = {
  clientId: string;
  clientSecret: string;
  market: string;
  apiMode: "development" | "extended";
};

type Dependencies = {
  cache: CacheStore;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

export class SpotifyTokenManager {
  private readonly now: () => number;

  constructor(
    private readonly config: Pick<SpotifyConfig, "clientId" | "clientSecret">,
    private readonly dependencies: Dependencies,
  ) {
    this.now = dependencies.now ?? Date.now;
  }

  async getAccessToken(): Promise<string> {
    const cacheKey = `spotify:token:${this.config.clientId}`;
    const cached = cachedSpotifyTokenSchema.safeParse(await this.dependencies.cache.get(cacheKey));
    if (cached.success && cached.data.expiresAt > this.now() + 60_000) return cached.data.accessToken;

    const payload = await fetchJson({
      url: SPOTIFY_TOKEN_URL,
      schema: spotifyTokenResponseSchema,
      fetchImpl: this.dependencies.fetchImpl,
      retryTransient: true,
      init: {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ grant_type: "client_credentials" }),
      },
    });

    const ttlSeconds = Math.max(1, payload.expires_in - 60);
    await this.dependencies.cache.set(
      cacheKey,
      { accessToken: payload.access_token, expiresAt: this.now() + payload.expires_in * 1_000 },
      ttlSeconds,
    );
    return payload.access_token;
  }

  async invalidate(): Promise<void> {
    await this.dependencies.cache.delete(`spotify:token:${this.config.clientId}`);
  }
}

export class SpotifyAdapter {
  private readonly tokenManager: SpotifyTokenManager;
  private readonly now: () => number;

  constructor(
    private readonly config: SpotifyConfig,
    private readonly dependencies: Dependencies,
  ) {
    if (!config.clientId || !config.clientSecret) {
      throw new ProviderError({ code: "NOT_CONFIGURED", message: "Spotify credentials are not configured.", status: 503 });
    }
    if (!/^[A-Z]{2}$/.test(config.market)) {
      throw new ProviderError({ code: "INVALID_INPUT", message: "Spotify market must be a two-letter country code.", status: 400 });
    }
    this.tokenManager = new SpotifyTokenManager(config, dependencies);
    this.now = dependencies.now ?? Date.now;
  }

  async search(
    query: string,
    types: readonly SpotifySearchType[] = searchTypes,
    limit = 5,
    offset = 0,
  ): Promise<CatalogSearchResult> {
    const cleanQuery = query.trim();
    if (!cleanQuery || cleanQuery.length > 200) throw invalidInput("Search query must contain 1 to 200 characters.");
    if (limit < 1 || limit > 10 || offset < 0 || offset > 1_000) throw invalidInput("Spotify pagination is out of range.");
    if (types.length === 0 || types.some((type) => !searchTypes.includes(type))) throw invalidInput("Unknown Spotify search type.");

    const params = new URLSearchParams({
      q: cleanQuery,
      type: types.join(","),
      market: this.config.market,
      limit: String(limit),
      offset: String(offset),
    });
    const payload = await this.request(
      `/search?${params}`,
      spotifySearchResponseSchema,
      `spotify:search:${this.config.apiMode}:${this.config.market}:${params}`,
      300,
    );

    return {
      songs: normalizePage(payload.tracks, (track) => normalizeTrack(track, this.now)),
      albums: normalizePage(payload.albums, normalizeAlbum),
      artists: normalizePage(payload.artists, normalizeArtist),
    };
  }

  async getTrack(id: string): Promise<Song> {
    assertSpotifyId(id);
    const params = new URLSearchParams({ market: this.config.market });
    const payload = await this.request(`/tracks/${id}?${params}`, spotifyTrackSchema, `spotify:track:${this.config.market}:${id}`, 3_600);
    return normalizeTrack(payload, this.now);
  }

  async getAlbum(id: string): Promise<Album> {
    assertSpotifyId(id);
    const params = new URLSearchParams({ market: this.config.market });
    const payload = await this.request(`/albums/${id}?${params}`, spotifyAlbumSchema, `spotify:album:${this.config.market}:${id}`, 900);
    return normalizeAlbum(payload);
  }

  async getAlbumTracks(id: string, limit = 10, offset = 0): Promise<Page<Song>> {
    assertSpotifyId(id);
    assertPage(limit, offset);
    const params = new URLSearchParams({ market: this.config.market, limit: String(limit), offset: String(offset) });
    const payload = await this.request(
      `/albums/${id}/tracks?${params}`,
      spotifyAlbumTracksSchema,
      `spotify:album-tracks:${this.config.market}:${id}:${limit}:${offset}`,
      900,
    );
    return normalizePage(payload, (track) => normalizeTrack(track, this.now));
  }

  async getArtist(id: string): Promise<Artist> {
    assertSpotifyId(id);
    const payload = await this.request(`/artists/${id}`, spotifyArtistSchema, `spotify:artist:${id}`, 900);
    return normalizeArtist(payload);
  }

  async getArtistAlbums(id: string, limit = 10, offset = 0): Promise<Page<Album>> {
    assertSpotifyId(id);
    assertPage(limit, offset);
    const params = new URLSearchParams({
      include_groups: "album,single,compilation,appears_on",
      market: this.config.market,
      limit: String(limit),
      offset: String(offset),
    });
    const payload = await this.request(
      `/artists/${id}/albums?${params}`,
      spotifyArtistAlbumsSchema,
      `spotify:artist-albums:${this.config.market}:${id}:${limit}:${offset}`,
      900,
    );
    return normalizePage(payload, normalizeAlbum);
  }

  private async request<T>(
    path: string,
    schema: ZodType<T>,
    cacheKey: string,
    ttlSeconds: number,
  ): Promise<T> {
    const cached = await this.dependencies.cache.get(cacheKey);
    if (cached !== null) {
      const parsed = schema.safeParse(cached);
      if (parsed.success) return parsed.data;
      await this.dependencies.cache.delete(cacheKey);
    }

    const cooldownKey = `spotify:cooldown:${this.config.apiMode}`;
    const cooldown = z.object({ until: z.number().int().positive() }).safeParse(await this.dependencies.cache.get(cooldownKey));
    if (cooldown.success && cooldown.data.until > this.now()) {
      throw new ProviderError({
        code: "PROVIDER_RATE_LIMITED",
        message: "Spotify is in a shared rate-limit cooldown.",
        status: 429,
        retryable: true,
        retryAfterSeconds: Math.ceil((cooldown.data.until - this.now()) / 1_000),
      });
    }

    for (let authAttempt = 0; authAttempt < 2; authAttempt += 1) {
      const token = await this.tokenManager.getAccessToken();
      try {
        const payload = await fetchJson({
          url: new URL(`${SPOTIFY_API}${path}`),
          schema,
          fetchImpl: this.dependencies.fetchImpl,
          init: { headers: { Authorization: `Bearer ${token}` } },
        });
        await this.dependencies.cache.set(cacheKey, payload, ttlSeconds);
        return payload;
      } catch (error) {
        if (authAttempt === 0 && isProviderError(error) && error.status === 401) {
          await this.tokenManager.invalidate();
          continue;
        }
        if (isProviderError(error) && error.code === "PROVIDER_RATE_LIMITED") {
          const retryAfterSeconds = Math.max(1, error.retryAfterSeconds ?? 30);
          await this.dependencies.cache.set(
            cooldownKey,
            { until: this.now() + retryAfterSeconds * 1_000 },
            retryAfterSeconds,
          );
        }
        throw error;
      }
    }
    throw new ProviderError({ code: "PROVIDER_AUTH_FAILED", message: "Spotify authentication failed.", status: 401 });
  }
}

type RawPage<T> = { items: T[]; limit: number; offset: number; total: number; next?: string | null } | undefined;

function normalizePage<T, U>(page: RawPage<T>, normalize: (item: T) => U | null): Page<U> {
  if (!page) return { items: [], limit: 0, offset: 0, total: 0, hasMore: false };
  return {
    items: page.items.flatMap((item) => {
      const normalized = normalize(item);
      return normalized === null ? [] : [normalized];
    }),
    limit: page.limit,
    offset: page.offset,
    total: page.total,
    hasMore: page.next !== null && page.next !== undefined,
  };
}

function normalizeTrack(track: SpotifyTrackPayload, now: () => number): Song {
  const source = spotifyRef("track", track.id, track.external_urls?.spotify);
  const code = track.external_ids?.isrc ? normalizeIsrc(track.external_ids.isrc) : null;
  return {
    id: `spotify:track:${track.id}`,
    kind: "song",
    name: track.name,
    imageUrl: safeImageUrl(track.album?.images[0]?.url),
    sources: [source],
    artists: track.artists.map((artist) => ({ name: artist.name, spotifyId: artist.id })),
    album: track.album
      ? { name: track.album.name, spotifyId: track.album.id, ...(track.album.release_date ? { releaseDate: track.album.release_date } : {}) }
      : null,
    durationMs: track.duration_ms ?? null,
    explicit: track.explicit ?? null,
    isrcState: code ? "resolved" : track.external_ids ? "missing" : "unresolved",
    isrcs: code ? [{ code, sources: [source], checkedAt: new Date(now()).toISOString() }] : [],
  };
}

function normalizeAlbum(album: SpotifyAlbumPayload): Album {
  return {
    id: `spotify:album:${album.id}`,
    kind: "album",
    name: album.name,
    imageUrl: safeImageUrl(album.images[0]?.url),
    sources: [spotifyRef("album", album.id, album.external_urls?.spotify)],
    artists: album.artists.map((artist) => ({ name: artist.name, spotifyId: artist.id })),
    releaseDate: album.release_date ?? null,
    totalTracks: album.total_tracks ?? null,
  };
}

function normalizeArtist(artist: SpotifyArtistPayload): Artist {
  return {
    id: `spotify:artist:${artist.id}`,
    kind: "artist",
    name: artist.name,
    imageUrl: safeImageUrl(artist.images?.[0]?.url),
    sources: [spotifyRef("artist", artist.id, artist.external_urls?.spotify)],
  };
}

function spotifyRef(kind: "track" | "album" | "artist", id: string, candidate?: string): ProviderRef {
  const fallback = `https://open.spotify.com/${kind}/${id}`;
  if (!candidate) return { provider: "spotify", id, url: fallback };
  try {
    const url = new URL(candidate);
    return { provider: "spotify", id, url: url.protocol === "https:" && url.hostname === "open.spotify.com" ? url.toString() : fallback };
  } catch {
    return { provider: "spotify", id, url: fallback };
  }
}

function safeImageUrl(candidate?: string): string | null {
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    const allowed = url.hostname === "image-cdn-ak.spotifycdn.com" || url.hostname.endsWith(".scdn.co");
    return url.protocol === "https:" && allowed ? url.toString() : null;
  } catch {
    return null;
  }
}

function assertSpotifyId(id: string): void {
  if (!/^[A-Za-z0-9]{22}$/.test(id)) throw invalidInput("Invalid Spotify identifier.");
}

function assertPage(limit: number, offset: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50 || !Number.isInteger(offset) || offset < 0 || offset > 1_000) {
    throw invalidInput("Spotify pagination is out of range.");
  }
}

function invalidInput(message: string): ProviderError {
  return new ProviderError({ code: "INVALID_INPUT", message, status: 400 });
}
