import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SavedLibraryProvider } from "@/features/library/saved-library-provider";
import { NAME_ONLY_SEARCH_MESSAGE } from "@/lib/domain/search-input";
import type { SearchApiResponse } from "@/lib/domain/search-contract";
import type { SavedRepository } from "@/lib/storage/saved-repository";

import { SearchResults } from "./search-results";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SearchResults", () => {
  it("does not let a late response replace the current query", async () => {
    let resolveOld: ((response: Response) => void) | undefined;
    const oldResponse = new Promise<Response>((resolve) => {
      resolveOld = resolve;
    });
    vi.stubGlobal("fetch", vi.fn((input: string | URL | Request) => {
      const url = String(input);
      return url.includes("q=Old")
        ? oldResponse
        : Promise.resolve(jsonResponse(searchResponse("New", "New result")));
    }));

    const repository = emptyRepository();
    const view = render(<SavedLibraryProvider repository={repository}><SearchResults query="Old" category="all" /></SavedLibraryProvider>);
    view.rerender(<SavedLibraryProvider repository={repository}><SearchResults query="New" category="all" /></SavedLibraryProvider>);
    expect(await screen.findByText("New result")).toBeInTheDocument();

    await act(async () => {
      resolveOld?.(jsonResponse(searchResponse("Old", "Old result")));
      await Promise.resolve();
    });
    expect(screen.queryByText("Old result")).not.toBeInTheDocument();
  });

  it("appends a category page without duplicating existing rows", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(searchResponse("Fixture", "First result", "next-page", "song")))
      .mockResolvedValueOnce(jsonResponse(searchResponse("Fixture", "Second result", null, "song", "track-2")));
    vi.stubGlobal("fetch", fetchMock);

    render(<SavedLibraryProvider repository={emptyRepository()}><SearchResults query="Fixture" category="song" /></SavedLibraryProvider>);
    expect(await screen.findByText("First result")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));

    expect(await screen.findByText("Second result")).toBeInTheDocument();
    expect(screen.getAllByText("First result")).toHaveLength(1);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("cursor=next-page");
  });

  it("places the album and year under the artists and hides the code on the copy button", async () => {
    const response = searchResponse("Fixture", "Pavazha Malli");
    const song = response.data.sections.songs.items[0];
    if (!song) throw new Error("Missing fixture song");
    song.artists = [{ name: "Sai Abhyankkar" }, { name: "Shruti Haasan" }];
    song.album = { name: "Pavazha Malli (From \"Think Indie\")", releaseDate: "2026-03-05" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(response)));

    render(<SavedLibraryProvider repository={emptyRepository()}><SearchResults query="Fixture" category="all" /></SavedLibraryProvider>);

    expect(await screen.findByRole("heading", { name: "Pavazha Malli" })).toBeInTheDocument();
    expect(screen.getByText("Sai Abhyankkar, Shruti Haasan")).toBeInTheDocument();
    expect(screen.getByText("Pavazha Malli (From \"Think Indie\") · 2026")).toBeInTheDocument();
    const copy = screen.getByRole("button", { name: /copy isrc:USRC17607839/i });
    expect(copy).toHaveTextContent("Copy Code");
    expect(copy).not.toHaveTextContent("USRC17607839");
    expect(screen.getByRole("button", { name: /save USRC17607839/i })).toBeInTheDocument();
  });

  it("makes a partial-provider state visible", async () => {
    const response = searchResponse("Fixture", "Available result");
    response.meta.partial = true;
    response.meta.providers.spotify = "unavailable";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(response)));

    render(<SavedLibraryProvider repository={emptyRepository()}><SearchResults query="Fixture" category="all" /></SavedLibraryProvider>);
    expect(await screen.findByText(/Part of this search didn’t respond/i)).toBeInTheDocument();
    expect(screen.getByText("Available result")).toBeInTheDocument();
  });

  it("shows the name-only rejection instead of an empty result list", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      error: { code: "UNSUPPORTED_INPUT", message: NAME_ONLY_SEARCH_MESSAGE, retryable: false, retryAfterSeconds: null },
      meta: { requestId: "fixture-request" },
    }, 400)));

    render(<SavedLibraryProvider repository={emptyRepository()}><SearchResults query="isrc:USRC17607839" category="all" /></SavedLibraryProvider>);

    expect(await screen.findByRole("heading", { name: "Use a name" })).toBeInTheDocument();
    expect(screen.getByText(NAME_ONLY_SEARCH_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText("No matching results")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("shows Songs then Albums and links an album without recording actions", async () => {
    const response = searchResponse("Fixture", "Fixture song");
    response.data.sections.albums.items = [{
      id: "spotify:album:1234567890123456789012",
      kind: "album",
      name: "Fixture album",
      imageUrl: null,
      sources: [{ provider: "spotify", id: "1234567890123456789012", url: "https://open.spotify.com/album/1234567890123456789012" }],
      artists: [{ name: "Fixture artist" }],
      releaseDate: "2026",
      totalTracks: 8,
    }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(response)));

    render(<SavedLibraryProvider repository={emptyRepository()}><SearchResults query="Fixture" category="all" /></SavedLibraryProvider>);

    const headings = (await screen.findAllByRole("heading", { level: 2 })).map((heading) => heading.textContent);
    expect(headings).toEqual(["Songs", "Albums"]);
    const albumSectionElement = screen.getByRole("heading", { name: "Albums" }).closest("section");
    if (!albumSectionElement) throw new Error("Missing album section");
    const album = within(albumSectionElement);
    expect(album.getByRole("link", { name: "View all" })).toHaveAttribute("href", "/search?q=Fixture&type=album");
    expect(album.getByRole("link", { name: "Open album Fixture album" })).toHaveAttribute("href", "/albums/1234567890123456789012");
    expect(album.queryByRole("button", { name: /copy|save/i })).not.toBeInTheDocument();
  });

  it("distinguishes an empty album filter from an unavailable album section", async () => {
    const empty = searchResponse("Fixture", "Ignored song", null, "album");
    empty.data.sections.songs = { items: [], limit: 0, nextCursor: null, state: "not_applicable", message: null };
    empty.data.sections.albums = { items: [], limit: 10, nextCursor: null, state: "ok", message: null };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(empty)));
    const view = render(<SavedLibraryProvider repository={emptyRepository()}><SearchResults query="Fixture" category="album" /></SavedLibraryProvider>);
    expect(await screen.findByText("No matching results")).toBeInTheDocument();
    expect(screen.queryByText(/No albums matched/i)).not.toBeInTheDocument();

    const unavailable = searchResponse("Fixture", "Ignored song", null, "album");
    unavailable.data.sections.songs = { items: [], limit: 0, nextCursor: null, state: "not_applicable", message: null };
    unavailable.data.sections.albums = {
      items: [],
      limit: 10,
      nextCursor: null,
      state: "unavailable",
      message: "Spotify didn’t respond for this part of the search. Try again.",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(unavailable)));
    view.rerender(<SavedLibraryProvider repository={emptyRepository()}><SearchResults query="Other album" category="album" /></SavedLibraryProvider>);
    expect(await screen.findByText(/Spotify didn’t respond for this part of the search/i)).toBeInTheDocument();
    expect(screen.queryByText("No matching results")).not.toBeInTheDocument();
  });

  it("does not let a late album response replace a newer query", async () => {
    let resolveOld: ((response: Response) => void) | undefined;
    const oldResponse = new Promise<Response>((resolve) => {
      resolveOld = resolve;
    });
    vi.stubGlobal("fetch", vi.fn((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("q=Old")) return oldResponse;
      const next = searchResponse("New", "Ignored song", null, "album");
      next.data.sections.albums = albumSection("New album");
      return Promise.resolve(jsonResponse(next));
    }));

    const repository = emptyRepository();
    const view = render(<SavedLibraryProvider repository={repository}><SearchResults query="Old" category="album" /></SavedLibraryProvider>);
    view.rerender(<SavedLibraryProvider repository={repository}><SearchResults query="New" category="album" /></SavedLibraryProvider>);
    expect(await screen.findByText("New album")).toBeInTheDocument();

    const old = searchResponse("Old", "Ignored song", null, "album");
    old.data.sections.albums = albumSection("Old album", "1234567890123456789014");
    await act(async () => {
      resolveOld?.(jsonResponse(old));
      await Promise.resolve();
    });
    expect(screen.queryByText("Old album")).not.toBeInTheDocument();
  });
});

function emptyRepository(): SavedRepository {
  return {
    list: async () => ({ records: [], persistent: true, ignoredCount: 0 }),
    save: async () => ({ records: [], persistent: true }),
    remove: async () => ({ records: [], persistent: true }),
    clear: async () => ({ records: [], persistent: true }),
    migrateLegacy: async () => undefined,
    subscribe: () => () => undefined,
  };
}

function albumSection(name: string, id = "1234567890123456789012") {
  return {
    items: [{
      id: `spotify:album:${id}`,
      kind: "album" as const,
      name,
      imageUrl: null,
      sources: [{ provider: "spotify" as const, id, url: `https://open.spotify.com/album/${id}` }],
      artists: [{ name: "Fixture artist" }],
      releaseDate: "2026",
      totalTracks: 4,
    }],
    limit: 5,
    nextCursor: null,
    state: "ok" as const,
    message: null,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function searchResponse(
  query: string,
  title: string,
  nextCursor: string | null = null,
  type: "all" | "song" | "album" = "all",
  sourceId = "track-1",
): SearchApiResponse {
  const source = { provider: "spotify" as const, id: sourceId, url: `https://open.spotify.com/track/${sourceId}` };
  const inactiveState = type === "all" ? "ok" as const : "not_applicable" as const;
  return {
    data: {
      query,
      type,
      sections: {
        songs: {
          items: [{
            id: `spotify:song:${sourceId}`,
            kind: "song" as const,
            name: title,
            imageUrl: null,
            sources: [source],
            artists: [{ name: "Fixture artist" }],
            album: null,
            durationMs: 180_000,
            explicit: false,
            isrcState: "resolved" as const,
            isrcs: [{ code: "USRC17607839", sources: [source], checkedAt: "2026-09-28T00:00:00.000Z" }],
          }],
          limit: type === "all" ? 5 : 10,
          nextCursor,
          state: "ok" as const,
          message: null,
        },
        albums: { items: [], limit: type === "all" ? 5 : 0, nextCursor: null, state: inactiveState, message: null },
      },
    },
    meta: {
      requestId: "fixture-request",
      partial: false,
      providers: { spotify: "ok" as const, musicbrainz: "ok" as const },
      searchesRemaining: 10,
      allowanceNotice: null,
    },
  };
}
