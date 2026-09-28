import type { Song } from "./catalog";

const QUALIFIERS = ["remix", "live", "clean", "explicit"] as const;

export function normalizeMatchText(value: string): string {
  return value
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function primaryArtistName(song: Song): string {
  return song.artists[0]?.name ?? "";
}

export function versionQualifiers(title: string): ReadonlySet<string> {
  const text = normalizeMatchText(title);
  return new Set(QUALIFIERS.filter((qualifier) => new RegExp(`\\b${qualifier}\\b`, "u").test(text)));
}

function tokenSet(value: string): Set<string> {
  return new Set(normalizeMatchText(value).split(" ").filter(Boolean));
}

export function titlesConflict(left: string, right: string): boolean {
  const a = normalizeMatchText(left);
  const b = normalizeMatchText(right);
  if (a === b) return false;
  const tokensA = tokenSet(a);
  const tokensB = tokenSet(b);
  if (tokensA.size === 0 || tokensB.size === 0) return true;
  const overlap = [...tokensA].filter((token) => tokensB.has(token)).length;
  return overlap / Math.min(tokensA.size, tokensB.size) < 0.5;
}

export function artistsConflict(left: Song, right: Song): boolean {
  const a = normalizeMatchText(primaryArtistName(left));
  const b = normalizeMatchText(primaryArtistName(right));
  return a.length > 0 && b.length > 0 && a !== b;
}

export function sharedIsrcs(left: Song, right: Song): string[] {
  const rightCodes = new Set(right.isrcs.map((item) => item.code));
  return left.isrcs.map((item) => item.code).filter((code) => rightCodes.has(code));
}

export function canJoinByIsrc(left: Song, right: Song): boolean {
  return sharedIsrcs(left, right).length > 0 && !artistsConflict(left, right) && !titlesConflict(left.name, right.name);
}

export function exactMetadataMatch(left: Song, right: Song): boolean {
  if (normalizeMatchText(left.name) !== normalizeMatchText(right.name)) return false;
  if (normalizeMatchText(primaryArtistName(left)) !== normalizeMatchText(primaryArtistName(right))) return false;
  const leftQualifiers = versionQualifiers(left.name);
  const rightQualifiers = versionQualifiers(right.name);
  if (leftQualifiers.size !== rightQualifiers.size) return false;
  for (const qualifier of leftQualifiers) {
    if (!rightQualifiers.has(qualifier)) return false;
  }
  if (left.explicit !== null && right.explicit !== null && left.explicit !== right.explicit) return false;
  return true;
}

export function durationsCompatible(left: Song, right: Song): boolean {
  if (left.durationMs === null || right.durationMs === null) return false;
  return Math.abs(left.durationMs - right.durationMs) <= 2_000;
}

export function canEnrichWithoutIsrc(primary: Song, candidate: Song, otherCandidates: readonly Song[]): boolean {
  if (primary.isrcs.length > 0 && candidate.isrcs.length > 0) return false;
  if (!exactMetadataMatch(primary, candidate) || !durationsCompatible(primary, candidate)) return false;
  return otherCandidates.every((other) => other === candidate || !exactMetadataMatch(primary, other) || !durationsCompatible(primary, other));
}

export function mergeSongEvidence(primary: Song, secondary: Song): Song {
  const sources = new Map(primary.sources.map((source) => [`${source.provider}:${source.id}`, source]));
  secondary.sources.forEach((source) => sources.set(`${source.provider}:${source.id}`, source));
  const evidence = new Map(primary.isrcs.map((item) => [item.code, item]));
  secondary.isrcs.forEach((item) => {
    const existing = evidence.get(item.code);
    if (!existing) {
      evidence.set(item.code, item);
      return;
    }
    const refs = new Map(existing.sources.map((source) => [`${source.provider}:${source.id}`, source]));
    item.sources.forEach((source) => refs.set(`${source.provider}:${source.id}`, source));
    evidence.set(item.code, { ...existing, sources: [...refs.values()] });
  });
  const isrcs = [...evidence.values()];
  const isrcState = isrcs.length > 0
    ? "resolved" as const
    : primary.isrcState === "error" || secondary.isrcState === "error"
      ? "error" as const
      : primary.isrcState === "missing" || secondary.isrcState === "missing"
        ? "missing" as const
        : primary.isrcState;
  return {
    ...primary,
    sources: [...sources.values()],
    isrcs,
    isrcState,
    durationMs: primary.durationMs ?? secondary.durationMs,
    imageUrl: primary.imageUrl ?? secondary.imageUrl,
  };
}

export function mergeSongPages(
  spotify: readonly Song[],
  musicbrainz: readonly Song[],
  limit: number,
): { items: Song[]; spotifyConsumed: number; musicBrainzConsumed: number } {
  const items = spotify.slice(0, limit).map((song) => structuredClone(song));
  const spotifyConsumed = items.length;
  let musicBrainzConsumed = 0;

  for (const candidate of musicbrainz) {
    const isrcIndex = items.findIndex((item) => canJoinByIsrc(item, candidate));
    if (isrcIndex >= 0) {
      items[isrcIndex] = mergeSongEvidence(items[isrcIndex]!, candidate);
      musicBrainzConsumed += 1;
      continue;
    }

    const enrichIndex = items.findIndex((item) => canEnrichWithoutIsrc(item, candidate, musicbrainz));
    if (enrichIndex >= 0) {
      items[enrichIndex] = mergeSongEvidence(items[enrichIndex]!, candidate);
      musicBrainzConsumed += 1;
      continue;
    }

    if (items.length >= limit) break;
    items.push(structuredClone(candidate));
    musicBrainzConsumed += 1;
  }

  return { items, spotifyConsumed, musicBrainzConsumed };
}

export function rankSongs(songs: readonly Song[], query: string): Song[] {
  const normalizedQuery = normalizeMatchText(query);
  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  return songs
    .map((song, index) => ({ song, index, rank: relevance(song, normalizedQuery, queryTokens) }))
    .sort((left, right) => left.rank.tier - right.rank.tier || right.rank.resolved - left.rank.resolved || left.index - right.index)
    .map((row) => row.song);
}

function relevance(song: Song, query: string, queryTokens: readonly string[]): { tier: number; resolved: number } {
  const title = normalizeMatchText(song.name);
  const artist = normalizeMatchText(primaryArtistName(song));
  const haystackTokens = tokenSet(`${title} ${artist}`);
  const titleAndArtistInQuery = title.length > 0 && artist.length > 0 && query.includes(title) && query.includes(artist);
  const overlap = queryTokens.filter((token) => haystackTokens.has(token)).length;
  const strongOverlap = queryTokens.length > 0 && overlap / queryTokens.length >= 0.6;
  const exactTitle = title.length > 0 && (query === title || query.includes(title));
  const tier = titleAndArtistInQuery ? 1 : strongOverlap || exactTitle ? 2 : 3;
  return { tier, resolved: song.isrcs.length > 0 ? 1 : 0 };
}

export function detailEnrichmentTargets(songs: readonly Song[], limit = 2): Array<{ index: number; musicbrainzId: string }> {
  const targets: Array<{ index: number; musicbrainzId: string }> = [];
  for (const [index, song] of songs.entries()) {
    if (targets.length >= limit) break;
    if (song.isrcs.length > 0 || song.isrcState === "error") continue;
    const hasSpotify = song.sources.some((source) => source.provider === "spotify");
    const musicbrainz = song.sources.find((source) => source.provider === "musicbrainz");
    if (!hasSpotify || !musicbrainz) continue;
    targets.push({ index, musicbrainzId: musicbrainz.id });
  }
  return targets;
}
