import type { Album, CatalogSearchResult, Page, Song } from "@/lib/domain/catalog";
import { detailEnrichmentTargets, mergeSongEvidence, mergeSongPages, rankSongs } from "@/lib/domain/recording-match";
import { classifySearchInput, NAME_ONLY_SEARCH_MESSAGE, SearchInputError } from "@/lib/domain/search-input";
import type { ProviderState, SearchData } from "@/lib/domain/search-contract";
import type { SearchCategory } from "@/lib/domain/search";
import { isProviderError, ProviderError } from "@/lib/server/infra/provider-error";
import type { MusicBrainzAdapter } from "@/lib/server/providers/musicbrainz";
import type { SpotifyAdapter, SpotifySearchType } from "@/lib/server/providers/spotify";

import { SearchCursorCodec, SearchCursorError } from "./search-cursor";

type SearchRequest = {
  query: string;
  type: SearchCategory;
  limit: number;
  cursor: string | null;
  useSpotify?: boolean;
};

export type CatalogSearchResponse = {
  data: SearchData;
  partial: boolean;
  providers: { spotify: ProviderState; musicbrainz: ProviderState };
};

type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };
type SearchProviders = {
  spotify: Pick<SpotifyAdapter, "search">;
  musicbrainz: Pick<MusicBrainzAdapter, "searchRecordings" | "getRecording">;
};

export class CatalogSearchService {
  constructor(
    private readonly providers: SearchProviders,
    private readonly cursorCodec: SearchCursorCodec,
  ) {}

  async search(request: SearchRequest): Promise<CatalogSearchResponse> {
    const classified = classifySearchInput(request.query);
    if (classified.kind === "unsupported") {
      throw new CatalogSearchError("UNSUPPORTED_INPUT", NAME_ONLY_SEARCH_MESSAGE, 400);
    }
    if (request.type === "all" && request.cursor) {
      throw new CatalogSearchError("INVALID_CURSOR", "Mixed search does not accept a pagination cursor.", 400);
    }

    const offsets = request.type === "all"
      ? { spotifyOffset: 0, musicbrainzOffset: 0 }
      : request.cursor
        ? this.cursorCodec.decode(request.cursor, { query: classified.value, type: request.type })
        : { spotifyOffset: 0, musicbrainzOffset: 0 };

    const useSpotify = request.useSpotify !== false;
    const spotifyTypes = selectedSpotifyTypes(request.type);
    const needsSongs = request.type === "all" || request.type === "song";
    const spotifyPromise = useSpotify && spotifyTypes.length > 0
      ? settleWithin(
          this.providers.spotify.search(
            classified.value,
            spotifyTypes,
            request.limit,
            offsets.spotifyOffset,
          ),
          8_000,
        )
      : Promise.resolve<Settled<CatalogSearchResult>>({ ok: true, value: emptySpotifyResult() });
    const musicBrainzPromise = needsSongs
      ? settleWithin(
          this.providers.musicbrainz.searchRecordings(classified.value, request.limit, offsets.musicbrainzOffset),
          8_000,
        )
      : Promise.resolve<Settled<Page<Song>>>({ ok: true, value: emptyPage() });

    const [spotify, musicbrainz] = await Promise.all([spotifyPromise, musicBrainzPromise]);
    const spotifyState = !useSpotify ? "skipped" : spotify.ok ? "ok" : providerState(spotify.error);
    const musicBrainzState = needsSongs ? (musicbrainz.ok ? "ok" : providerState(musicbrainz.error)) : "skipped";
    const anyUsableProvider = spotify.ok || (needsSongs && musicbrainz.ok) || !useSpotify;
    if (!anyUsableProvider) throw bestProviderError(spotify, musicbrainz);

    const spotifyResult = spotify.ok ? spotify.value : emptySpotifyResult();
    const musicBrainzResult = musicbrainz.ok ? musicbrainz.value : emptyPage<Song>();
    const mergedSongs = mergeSongPages(spotifyResult.songs.items, musicBrainzResult.items, request.limit);
    mergedSongs.items = await enrichMissingCodes(this.providers.musicbrainz, mergedSongs.items);
    mergedSongs.items = rankSongs(mergedSongs.items, classified.value);
    const nextCursor = request.type !== "all"
      ? createNextCursor(this.cursorCodec, {
          query: classified.value,
          type: request.type,
          spotifyOffset: offsets.spotifyOffset + selectedSpotifyCount(request.type, spotifyResult, mergedSongs.spotifyConsumed),
          musicbrainzOffset: offsets.musicbrainzOffset + mergedSongs.musicBrainzConsumed,
          hasMore: selectedHasMore(request.type, spotifyResult, musicBrainzResult, mergedSongs),
        })
      : null;

    const data = buildSearchData({
      query: request.query,
      type: request.type,
      spotify: spotifyResult,
      songs: mergedSongs.items,
      nextCursor,
      spotifyState,
      musicBrainzState,
      limit: request.limit,
    });
    return {
      data,
      partial: (spotifyState !== "ok" && spotifyState !== "skipped") || (needsSongs && musicBrainzState !== "ok"),
      providers: { spotify: spotifyState, musicbrainz: musicBrainzState },
    };
  }
}

export class CatalogSearchError extends Error {
  constructor(
    readonly code: "INVALID_INPUT" | "INVALID_CURSOR" | "UNSUPPORTED_INPUT",
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CatalogSearchError";
  }
}

type MergedSongPage = {
  items: Song[];
  spotifyConsumed: number;
  musicBrainzConsumed: number;
};

async function enrichMissingCodes(
  musicbrainz: Pick<MusicBrainzAdapter, "getRecording">,
  songs: Song[],
): Promise<Song[]> {
  const targets = detailEnrichmentTargets(songs, 2);
  if (targets.length === 0) return songs;
  const details = await Promise.all(targets.map(async (target) => {
    const settled = await settleWithin(musicbrainz.getRecording(target.musicbrainzId), 8_000);
    return { ...target, settled };
  }));
  const next = [...songs];
  for (const detail of details) {
    const current = next[detail.index];
    if (!current) continue;
    if (detail.settled.ok) {
      next[detail.index] = mergeSongEvidence(current, detail.settled.value);
      continue;
    }
    next[detail.index] = { ...current, isrcState: "error" };
  }
  return next;
}

function buildSearchData(input: {
  query: string;
  type: SearchCategory;
  spotify: CatalogSearchResult;
  songs: Song[];
  nextCursor: string | null;
  spotifyState: ProviderState;
  musicBrainzState: ProviderState;
  limit: number;
}): SearchData {
  const selected = (category: Exclude<SearchCategory, "all">) => input.type === "all" || input.type === category;
  const unavailableMessage = (provider: string) => `${provider} didn’t respond for this part of the search. Try again.`;
  const songUnavailable = input.spotifyState !== "ok" && input.musicBrainzState !== "ok";

  return {
    query: input.query,
    type: input.type,
    sections: {
      songs: selected("song")
        ? {
            items: input.songs,
            limit: input.limit,
            nextCursor: input.type === "song" ? input.nextCursor : null,
            state: songUnavailable ? "unavailable" : "ok",
            message: songUnavailable ? unavailableMessage("Song search") : null,
          }
        : notApplicable<Song>(),
      albums: selected("album")
        ? providerSection(input.spotify.albums.items, input.limit, input.type === "album" ? input.nextCursor : null, input.spotifyState, "Spotify")
        : notApplicable<Album>(),
    },
  };
}

function providerSection<T>(items: T[], limit: number, nextCursor: string | null, state: ProviderState, provider: string) {
  if (state === "ok") return { items, limit, nextCursor, state: "ok" as const, message: null };
  if (state === "skipped") return { items: [] as T[], limit, nextCursor: null, state: "ok" as const, message: null };
  return { items: [] as T[], limit, nextCursor: null, state: "unavailable" as const, message: `${provider} didn’t respond for this part of the search. Try again.` };
}

function notApplicable<T>(message: string | null = null) {
  return { items: [] as T[], limit: 0, nextCursor: null, state: "not_applicable" as const, message };
}

function createNextCursor(
  codec: SearchCursorCodec,
  input: {
    query: string;
    type: Exclude<SearchCategory, "all">;
    spotifyOffset: number;
    musicbrainzOffset: number;
    hasMore: boolean;
  },
): string | null {
  return input.hasMore ? codec.encode(input) : null;
}

function selectedSpotifyTypes(type: SearchCategory): SpotifySearchType[] {
  if (type === "all") return ["track", "album"];
  return [type === "song" ? "track" : "album"];
}

function selectedSpotifyCount(
  type: SearchCategory,
  result: CatalogSearchResult,
  songConsumed: number,
): number {
  if (type === "song") return songConsumed;
  if (type === "album") return result.albums.items.length;
  return 0;
}

function selectedHasMore(
  type: SearchCategory,
  spotify: CatalogSearchResult,
  musicbrainz: Page<Song>,
  merged: MergedSongPage,
): boolean {
  if (type === "song") {
    return spotify.songs.hasMore || merged.spotifyConsumed < spotify.songs.items.length || musicbrainz.hasMore || merged.musicBrainzConsumed < musicbrainz.items.length;
  }
  if (type === "album") return spotify.albums.hasMore;
  return false;
}

async function settleWithin<T>(promise: Promise<T>, milliseconds: number): Promise<Settled<T>> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise.then((value): Settled<T> => ({ ok: true, value })).catch((error): Settled<T> => ({ ok: false, error })),
      new Promise<Settled<T>>((resolve) => {
        timeout = setTimeout(
          () => resolve({ ok: false, error: new ProviderError({ code: "PROVIDER_TIMEOUT", message: "Search timed out.", status: 504, retryable: true }) }),
          milliseconds,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function providerState(error: unknown): ProviderState {
  if (!isProviderError(error)) return "unavailable";
  if (error.code === "NOT_CONFIGURED") return "not_configured";
  if (error.code === "PROVIDER_RATE_LIMITED") return "rate_limited";
  return "unavailable";
}

function bestProviderError(...results: Settled<unknown>[]): Error {
  const error = results.find((result) => !result.ok && isProviderError(result.error));
  return error && !error.ok ? error.error as Error : new ProviderError({ code: "PROVIDER_UNAVAILABLE", message: "No provider could answer the search.", status: 503 });
}

function emptySpotifyResult(): CatalogSearchResult {
  return { songs: emptyPage(), albums: emptyPage(), artists: emptyPage() };
}

function emptyPage<T>(): Page<T> {
  return { items: [], limit: 0, offset: 0, total: 0, hasMore: false };
}

export function normalizeCatalogSearchError(error: unknown): CatalogSearchError | ProviderError {
  if (error instanceof CatalogSearchError || error instanceof ProviderError) return error;
  if (error instanceof SearchCursorError) return new CatalogSearchError("INVALID_CURSOR", error.message, 400);
  if (error instanceof SearchInputError) {
    return new CatalogSearchError(error.code === "UNSUPPORTED_INPUT" ? "UNSUPPORTED_INPUT" : "INVALID_INPUT", error.message, 400);
  }
  return new ProviderError({ code: "PROVIDER_UNAVAILABLE", message: "Search is temporarily unavailable.", status: 503, retryable: true, cause: error });
}
