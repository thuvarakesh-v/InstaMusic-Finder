import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SavedLibraryProvider } from "@/features/library/saved-library-provider";
import type { SavedIsrc } from "@/lib/storage/saved-schema";
import type { SavedRepository } from "@/lib/storage/saved-repository";

import { RecentSaves } from "./recent-saves";

describe("RecentSaves", () => {
  it("hides the preview while loading or when nothing is saved", async () => {
    render(
      <SavedLibraryProvider repository={repositoryWith([])}>
        <RecentSaves />
      </SavedLibraryProvider>,
    );
    expect(screen.queryByRole("heading", { name: "Recently saved" })).not.toBeInTheDocument();
  });

  it("shows up to three recently saved tracks with a View all link", async () => {
    render(
      <SavedLibraryProvider repository={repositoryWith([fixtureRecord()])}>
        <RecentSaves />
      </SavedLibraryProvider>,
    );
    expect(await screen.findByRole("heading", { name: "Recently saved" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute("href", "/saved");
    expect(screen.getByText("Fixture track")).toBeInTheDocument();
  });
});

function fixtureRecord(): SavedIsrc {
  return {
    key: "isrc:USRC17607839",
    code: "USRC17607839",
    trackName: "Fixture track",
    artistName: "Fixture artist",
    albumName: "Fixture album",
    releaseYear: "2026",
    artworkUrl: null,
    spotifyTrackId: "1234567890123456789012",
    spotifyTrackUrl: "https://open.spotify.com/track/1234567890123456789012",
    savedAt: "2026-09-28T00:00:00.000Z",
    updatedAt: "2026-09-28T00:00:00.000Z",
    schemaVersion: 1,
  };
}

function repositoryWith(records: SavedIsrc[]): SavedRepository {
  return {
    list: async () => ({ records, persistent: true, ignoredCount: 0 }),
    save: async () => ({ records, persistent: true }),
    remove: async () => ({ records, persistent: true }),
    clear: async () => ({ records: [], persistent: true }),
    migrateLegacy: async () => undefined,
    subscribe: () => () => undefined,
  };
}
