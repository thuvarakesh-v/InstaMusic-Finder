import { z } from "zod";

import type { Song } from "@/lib/domain/catalog";
import { formatInstagramSearch, normalizeIsrc } from "@/lib/domain/isrc";

export const savedIsrcSchema = z.object({
  key: z.string().regex(/^isrc:[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/),
  code: z.string().regex(/^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/),
  trackName: z.string().min(1).max(500),
  artistName: z.string().min(1).max(500),
  albumName: z.string().max(500).nullable(),
  releaseYear: z.string().regex(/^\d{4}$/).nullable().optional(),
  artworkUrl: z.url().nullable(),
  spotifyTrackId: z.string().regex(/^[A-Za-z0-9]{22}$/).nullable(),
  spotifyTrackUrl: z.url().nullable(),
  savedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  schemaVersion: z.literal(1),
});

export type SavedIsrc = z.infer<typeof savedIsrcSchema>;

function releaseYear(date: string | undefined): string | null {
  const year = date?.slice(0, 4);
  return year && /^\d{4}$/.test(year) ? year : null;
}

export function savedKey(code: string): string | null {
  const normalized = normalizeIsrc(code);
  return normalized ? formatInstagramSearch(normalized) : null;
}

export function createSavedIsrc(song: Song, code: string, existing?: SavedIsrc, now = new Date()): SavedIsrc {
  const normalized = normalizeIsrc(code);
  if (!normalized || !song.isrcs.some((evidence) => evidence.code === normalized)) {
    throw new Error("Only provider-backed recording codes can be saved.");
  }
  const spotify = song.sources.find((source) => source.provider === "spotify" && /^[A-Za-z0-9]{22}$/.test(source.id));
  const timestamp = now.toISOString();
  return savedIsrcSchema.parse({
    key: formatInstagramSearch(normalized),
    code: normalized,
    trackName: song.name,
    artistName: song.artists.map((artist) => artist.name).filter(Boolean).join(", ") || "Unknown artist",
    albumName: song.album?.name ?? null,
    releaseYear: releaseYear(song.album?.releaseDate),
    artworkUrl: song.imageUrl,
    spotifyTrackId: spotify?.id ?? null,
    spotifyTrackUrl: spotify?.url ?? null,
    savedAt: existing?.savedAt ?? timestamp,
    updatedAt: timestamp,
    schemaVersion: 1,
  });
}
