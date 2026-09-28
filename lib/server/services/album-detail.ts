import type { Album, Page, Song } from "@/lib/domain/catalog";
import type { SpotifyAdapter } from "@/lib/server/providers/spotify";

type AlbumProvider = Pick<SpotifyAdapter, "getAlbum" | "getAlbumTracks" | "getTrack">;

export type AlbumDetail = {
  album: Album;
  tracks: Song[];
  partial: boolean;
};

export class AlbumDetailService {
  constructor(private readonly spotify: AlbumProvider) {}

  async get(id: string): Promise<AlbumDetail> {
    const albumPromise = this.spotify.getAlbum(id);
    const summariesPromise = this.getAllTrackSummaries(id);
    const [album, summaries] = await Promise.all([albumPromise, summariesPromise]);
    const hydrated = await mapWithConcurrency(summaries, 3, async (summary) => {
      const sourceId = summary.sources.find((source) => source.provider === "spotify")?.id;
      if (!sourceId) {
        return { track: { ...summary, isrcState: "error" as const, isrcs: [] }, failed: true };
      }
      try {
        return { track: await this.spotify.getTrack(sourceId), failed: false };
      } catch {
        return { track: { ...summary, isrcState: "error" as const, isrcs: [] }, failed: true };
      }
    });
    return {
      album,
      tracks: hydrated.map((item) => item.track),
      partial: hydrated.some((item) => item.failed),
    };
  }

  private async getAllTrackSummaries(id: string): Promise<Song[]> {
    const tracks: Song[] = [];
    let offset = 0;
    for (;;) {
      const page: Page<Song> = await this.spotify.getAlbumTracks(id, 50, offset);
      tracks.push(...page.items);
      if (!page.hasMore) return tracks;
      if (page.items.length === 0) throw new Error("Spotify album pagination did not advance.");
      offset += page.items.length;
      if (offset > 1_000) throw new Error("Spotify album exceeds the supported pagination range.");
    }
  }
}

async function mapWithConcurrency<T, U>(items: T[], concurrency: number, task: (item: T) => Promise<U>): Promise<U[]> {
  const results = new Array<U>(items.length);
  let nextIndex = 0;
  async function worker() {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await task(items[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}
