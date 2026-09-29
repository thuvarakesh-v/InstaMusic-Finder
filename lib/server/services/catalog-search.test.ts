import { describe, expect, it, vi } from "vitest";

import type { Album, Artist, CatalogSearchResult, Page, Song } from "@/lib/domain/catalog";
import { NAME_ONLY_SEARCH_MESSAGE } from "@/lib/domain/search-input";
import { ProviderError } from "@/lib/server/infra/provider-error";

import { CatalogSearchService } from "./catalog-search";
import { SearchCursorCodec } from "./search-cursor";

const spotifyRef = { provider: "spotify" as const, id: "track-1", url: "https://open.spotify.com/track/track-1" };
const musicBrainzRef = { provider: "musicbrainz" as const, id: "recording-1", url: "https://musicbrainz.org/recording/recording-1" };

function song(provider: "spotify" | "musicbrainz", id: string, code = "USRC17607839"): Song {
  const source = provider === "spotify" ? { ...spotifyRef, id } : { ...musicBrainzRef, id };
  return {
    id: `${provider}:song:${id}`,
    kind: "song",
    name: "Fixture Song",
    imageUrl: null,
    sources: [source],
    artists: [{ name: "Fixture Artist" }],
    album: null,
    durationMs: 180_000,
    explicit: false,
    isrcState: "resolved",
    isrcs: [{ code, sources: [source], checkedAt: "2026-09-28T00:00:00.000Z" }],
  };
}

function page<T>(items: T[], hasMore = false): Page<T> {
  return { items, limit: 5, offset: 0, total: items.length + (hasMore ? 1 : 0), hasMore };
}

function spotifyResult(options: { songs?: Song[]; hasMore?: boolean } = {}): CatalogSearchResult {
  const album: Album = { id: "spotify:album:1", kind: "album", name: "Fixture Album", imageUrl: null, sources: [{ ...spotifyRef, id: "album-1" }], artists: [{ name: "Fixture Artist" }], releaseDate: "2026", totalTracks: 10 };
  const artist: Artist = { id: "spotify:artist:1", kind: "artist", name: "Fixture Artist", imageUrl: null, sources: [{ ...spotifyRef, id: "artist-1" }] };
  return {
    songs: page(options.songs ?? [song("spotify", "track-1")], options.hasMore),
    albums: page([album], options.hasMore),
    artists: page([artist]),
  };
}

function serviceWith(options: { spotify?: CatalogSearchResult | Error; musicbrainz?: Page<Song> | Error; recording?: Song | Error } = {}) {
  const spotifySearch = vi.fn(async () => {
    if (options.spotify instanceof Error) throw options.spotify;
    return options.spotify ?? spotifyResult();
  });
  const musicBrainzSearch = vi.fn(async () => {
    if (options.musicbrainz instanceof Error) throw options.musicbrainz;
    return options.musicbrainz ?? page([song("musicbrainz", "recording-1")]);
  });
  const musicBrainzGetRecording = vi.fn(async (id: string) => {
    if (options.recording instanceof Error) throw options.recording;
    return options.recording ?? song("musicbrainz", id);
  });
  const service = new CatalogSearchService(
    {
      spotify: { search: spotifySearch },
      musicbrainz: { searchRecordings: musicBrainzSearch, getRecording: musicBrainzGetRecording },
    },
    new SearchCursorCodec("test-only-secret-with-at-least-32-bytes", { market: "US", mode: "development" }, () => 1_000),
  );
  return { service, spotifySearch, musicBrainzSearch, musicBrainzGetRecording };
}

describe("CatalogSearchService", () => {
  it("returns mixed sections and merges shared ISRC evidence", async () => {
    const { service, spotifySearch } = serviceWith();
    const result = await service.search({ query: "Fixture", type: "all", limit: 5, cursor: null });

    expect(result.partial).toBe(false);
    expect(spotifySearch).toHaveBeenCalledWith("Fixture", ["track", "album"], 5, 0);
    expect(result.data.sections.songs.items).toHaveLength(1);
    expect(result.data.sections.albums.items).toHaveLength(1);
    expect(result.data.sections.songs.items[0]?.sources).toHaveLength(2);
    expect(result.data.sections.songs.items[0]?.isrcs[0]?.sources).toHaveLength(2);
  });

  it("returns MusicBrainz recordings as partial results when Spotify is unavailable", async () => {
    const unavailable = new ProviderError({ code: "PROVIDER_UNAVAILABLE", message: "offline", status: 503, retryable: true });
    const { service } = serviceWith({ spotify: unavailable });
    const result = await service.search({ query: "Fixture", type: "all", limit: 5, cursor: null });

    expect(result.partial).toBe(true);
    expect(result.providers).toEqual({ spotify: "unavailable", musicbrainz: "ok" });
    expect(result.data.sections.songs.items).toHaveLength(1);
    expect(result.data.sections.albums.state).toBe("unavailable");
    expect(result.data.sections.albums.items).toHaveLength(0);
  });

  it.each([
    "isrc:USRC17607839",
    "US-RC1-76-07839",
    "USRC17607839",
    "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
    "spotify:track:4uLU6hMCjMI75M1A2tKUQC",
  ])("does not call providers for catalog lookup of %s", async (query) => {
    const { service, spotifySearch, musicBrainzSearch } = serviceWith();

    await expect(service.search({ query, type: "all", limit: 5, cursor: null })).rejects.toMatchObject({
      code: "UNSUPPORTED_INPUT",
      message: NAME_ONLY_SEARCH_MESSAGE,
    });
    expect(spotifySearch).not.toHaveBeenCalled();
    expect(musicBrainzSearch).not.toHaveBeenCalled();
  });

  it("issues a signed cursor for category results that have another page", async () => {
    const { service } = serviceWith({ spotify: spotifyResult({ hasMore: true }), musicbrainz: page([]) });
    const first = await service.search({ query: "Fixture", type: "song", limit: 1, cursor: null });
    const cursor = first.data.sections.songs.nextCursor;

    expect(cursor).toEqual(expect.any(String));
    await expect(service.search({ query: "Different", type: "song", limit: 1, cursor })).rejects.toThrow(/expired/i);
  });

  it("isolates a category request to its relevant Spotify type", async () => {
    const { service, spotifySearch, musicBrainzSearch } = serviceWith();
    const result = await service.search({ query: "Fixture", type: "album", limit: 10, cursor: null });

    expect(spotifySearch).toHaveBeenCalledWith("Fixture", ["album"], 10, 0);
    expect(musicBrainzSearch).not.toHaveBeenCalled();
    expect(result.providers.musicbrainz).toBe("skipped");
    expect(result.data.sections.songs.state).toBe("not_applicable");
  });

  it("pages album results without calling MusicBrainz", async () => {
    const { service, spotifySearch, musicBrainzSearch } = serviceWith({ spotify: spotifyResult({ hasMore: true }) });
    const first = await service.search({ query: "Fixture", type: "album", limit: 10, cursor: null });
    const cursor = first.data.sections.albums.nextCursor;

    expect(spotifySearch).toHaveBeenCalledWith("Fixture", ["album"], 10, 0);
    expect(musicBrainzSearch).not.toHaveBeenCalled();
    expect(first.providers.musicbrainz).toBe("skipped");
    expect(first.data.sections.songs.state).toBe("not_applicable");
    expect(first.data.sections.albums.items.map((item) => item.id)).toEqual(["spotify:album:1"]);
    expect(cursor).toEqual(expect.any(String));

    await service.search({ query: "Fixture", type: "album", limit: 10, cursor });
    expect(spotifySearch).toHaveBeenLastCalledWith("Fixture", ["album"], 10, 1);
  });

  it("rejects a song cursor used to page albums", async () => {
    const { service } = serviceWith({ spotify: spotifyResult({ hasMore: true }), musicbrainz: page([]) });
    const songs = await service.search({ query: "Fixture", type: "song", limit: 1, cursor: null });

    await expect(service.search({
      query: "Fixture",
      type: "album",
      limit: 10,
      cursor: songs.data.sections.songs.nextCursor,
    })).rejects.toThrow(/expired/i);
  });

  it("fails an album-only search when Spotify cannot answer", async () => {
    const unavailable = new ProviderError({ code: "PROVIDER_UNAVAILABLE", message: "offline", status: 503, retryable: true });
    const { service } = serviceWith({ spotify: unavailable });

    await expect(service.search({ query: "Fixture", type: "album", limit: 10, cursor: null })).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
    });
  });

  it("hydrates at most two unique MusicBrainz recordings that still lack a code", async () => {
    const unresolved = (id: string, mbId: string): Song => ({
      ...song("spotify", id, "USRC17607839"),
      isrcs: [],
      isrcState: "unresolved",
      durationMs: 180_000,
      sources: [
        { provider: "spotify", id, url: `https://open.spotify.com/track/${id}` },
        { provider: "musicbrainz", id: mbId, url: `https://musicbrainz.org/recording/${mbId}` },
      ],
    });
    const first = unresolved("track-a", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    const second = unresolved("track-b", "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    const third = unresolved("track-c", "cccccccc-cccc-cccc-cccc-cccccccccccc");
    const { service, musicBrainzGetRecording } = serviceWith({
      spotify: spotifyResult({ songs: [first, second, third] }),
      musicbrainz: page([]),
    });

    await service.search({ query: "Fixture", type: "song", limit: 5, cursor: null });
    expect(musicBrainzGetRecording).toHaveBeenCalledTimes(2);
  });

  it("marks a failed MusicBrainz detail lookup as error instead of missing", async () => {
    const unresolved: Song = {
      ...song("spotify", "track-a"),
      isrcs: [],
      isrcState: "unresolved",
      sources: [
        { provider: "spotify", id: "track-a", url: "https://open.spotify.com/track/track-a" },
        { provider: "musicbrainz", id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", url: "https://musicbrainz.org/recording/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" },
      ],
    };
    const { service } = serviceWith({
      spotify: spotifyResult({ songs: [unresolved] }),
      musicbrainz: page([]),
      recording: new ProviderError({ code: "PROVIDER_UNAVAILABLE", message: "offline", status: 503, retryable: true }),
    });
    const result = await service.search({ query: "Fixture", type: "song", limit: 5, cursor: null });
    expect(result.data.sections.songs.items[0]?.isrcState).toBe("error");
    expect(result.data.sections.songs.items[0]?.isrcs).toHaveLength(0);
  });

  it("skips Spotify and keeps MusicBrainz songs when useSpotify is false", async () => {
    const { service, spotifySearch, musicBrainzSearch } = serviceWith();
    const result = await service.search({ query: "Fixture", type: "all", limit: 5, cursor: null, useSpotify: false });

    expect(spotifySearch).not.toHaveBeenCalled();
    expect(musicBrainzSearch).toHaveBeenCalled();
    expect(result.partial).toBe(false);
    expect(result.providers).toEqual({ spotify: "skipped", musicbrainz: "ok" });
    expect(result.data.sections.songs.items).toHaveLength(1);
    expect(result.data.sections.albums.items).toHaveLength(0);
    expect(result.data.sections.albums.state).toBe("ok");
  });
});
