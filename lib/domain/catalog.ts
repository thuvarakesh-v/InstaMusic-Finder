export type Provider = "spotify" | "musicbrainz";

export type ProviderRef = {
  provider: Provider;
  id: string;
  url: string;
};

export type ArtistRef = {
  name: string;
  spotifyId?: string;
  musicbrainzId?: string;
};

export type IsrcEvidence = {
  code: string;
  sources: ProviderRef[];
  checkedAt: string;
};

type BaseEntity = {
  id: string;
  name: string;
  imageUrl: string | null;
  sources: ProviderRef[];
};

export type Song = BaseEntity & {
  kind: "song";
  artists: ArtistRef[];
  album: { name: string; spotifyId?: string; releaseDate?: string } | null;
  durationMs: number | null;
  explicit: boolean | null;
  isrcState: "unresolved" | "resolved" | "missing" | "error";
  isrcs: IsrcEvidence[];
};

export type Album = BaseEntity & {
  kind: "album";
  artists: ArtistRef[];
  releaseDate: string | null;
  totalTracks: number | null;
};

export type Artist = BaseEntity & {
  kind: "artist";
};

export type CatalogEntity = Song | Album | Artist;

export type CatalogSearchResult = {
  songs: Page<Song>;
  albums: Page<Album>;
  artists: Page<Artist>;
};

export type Page<T> = {
  items: T[];
  limit: number;
  offset: number;
  total: number | null;
  hasMore: boolean;
};
