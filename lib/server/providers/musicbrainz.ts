import type { Page, ProviderRef, Song } from "@/lib/domain/catalog";
import { normalizeIsrc } from "@/lib/domain/isrc";
import type { CacheStore } from "@/lib/server/infra/cache";
import { fetchJson } from "@/lib/server/infra/http";
import { ProviderError } from "@/lib/server/infra/provider-error";
import type { RequestStartScheduler } from "@/lib/server/infra/scheduler";

import {
  musicBrainzRecordingSchema,
  musicBrainzSearchSchema,
  type MusicBrainzRecordingPayload,
} from "./musicbrainz-schemas";

const MUSICBRAINZ_API = "https://musicbrainz.org/ws/2";

type MusicBrainzDependencies = {
  cache: CacheStore;
  scheduler: RequestStartScheduler;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

export class MusicBrainzAdapter {
  private readonly now: () => number;

  constructor(
    private readonly userAgent: string,
    private readonly dependencies: MusicBrainzDependencies,
  ) {
    if (!isMeaningfulUserAgent(userAgent)) {
      throw new ProviderError({
        code: "NOT_CONFIGURED",
        message: "MusicBrainz requires an application name, version, and real contact in its User-Agent.",
        status: 503,
      });
    }
    this.now = dependencies.now ?? Date.now;
  }

  async searchRecordings(query: string, limit = 5, offset = 0): Promise<Page<Song>> {
    const cleanQuery = query.trim();
    if (!cleanQuery || cleanQuery.length > 200) throw invalidInput("Recording query must contain 1 to 200 characters.");
    assertPage(limit, offset);
    return this.search(escapeLucene(cleanQuery), limit, offset);
  }

  async searchByIsrc(code: string, limit = 5): Promise<Page<Song>> {
    const normalized = normalizeIsrc(code);
    if (!normalized) throw invalidInput("A valid ISRC is required.");
    return this.search(`isrc:${normalized}`, limit, 0);
  }

  async getRecording(id: string): Promise<Song> {
    if (!isMbid(id)) throw invalidInput("Invalid MusicBrainz recording identifier.");
    const cacheKey = `musicbrainz:recording:${id}`;
    const cached = musicBrainzRecordingSchema.safeParse(await this.dependencies.cache.get(cacheKey));
    if (cached.success) return normalizeRecording(cached.data, this.now, true);

    const url = new URL(`${MUSICBRAINZ_API}/recording/${id}`);
    url.search = new URLSearchParams({ fmt: "json", inc: "isrcs+artists+releases" }).toString();
    const payload = await this.dependencies.scheduler.schedule(() =>
      fetchJson({
        url,
        schema: musicBrainzRecordingSchema,
        fetchImpl: this.dependencies.fetchImpl,
        init: { headers: { Accept: "application/json", "User-Agent": this.userAgent } },
      }),
    );
    await this.dependencies.cache.set(cacheKey, payload, 3_600);
    return normalizeRecording(payload, this.now, true);
  }

  private async search(query: string, limit: number, offset: number): Promise<Page<Song>> {
    assertPage(limit, offset);
    const params = new URLSearchParams({ query, fmt: "json", limit: String(limit), offset: String(offset) });
    const cacheKey = `musicbrainz:search:${params}`;
    const cached = musicBrainzSearchSchema.safeParse(await this.dependencies.cache.get(cacheKey));
    let payload;

    if (cached.success) {
      payload = cached.data;
    } else {
      const url = new URL(`${MUSICBRAINZ_API}/recording/`);
      url.search = params.toString();
      payload = await this.dependencies.scheduler.schedule(() =>
        fetchJson({
          url,
          schema: musicBrainzSearchSchema,
          fetchImpl: this.dependencies.fetchImpl,
          init: { headers: { Accept: "application/json", "User-Agent": this.userAgent } },
        }),
      );
      await this.dependencies.cache.set(cacheKey, payload, 300);
    }

    return {
      items: payload.recordings.map((recording) => normalizeRecording(recording, this.now, false)),
      limit,
      offset: payload.offset,
      total: payload.count,
      hasMore: payload.offset + payload.recordings.length < payload.count,
    };
  }
}

function normalizeRecording(recording: MusicBrainzRecordingPayload, now: () => number, checked: boolean): Song {
  const source = musicBrainzRef(recording.id);
  const codes = [...new Set((recording.isrcs ?? []).flatMap((candidate) => {
    const code = normalizeIsrc(candidate);
    return code ? [code] : [];
  }))];
  const artists = (recording["artist-credit"] ?? []).flatMap((credit) => {
    if (credit.artist) return [{ name: credit.artist.name, musicbrainzId: credit.artist.id }];
    if (credit.name) return [{ name: credit.name }];
    return [];
  });
  const release = recording.releases?.[0];

  return {
    id: `musicbrainz:recording:${recording.id}`,
    kind: "song",
    name: recording.title,
    imageUrl: null,
    sources: [source],
    artists,
    album: release ? { name: release.title, ...(release.date ? { releaseDate: release.date } : {}) } : null,
    durationMs: recording.length ?? null,
    explicit: null,
    isrcState: codes.length > 0 ? "resolved" : checked || recording.isrcs ? "missing" : "unresolved",
    isrcs: codes.map((code) => ({ code, sources: [source], checkedAt: new Date(now()).toISOString() })),
  };
}

function musicBrainzRef(id: string): ProviderRef {
  return { provider: "musicbrainz", id, url: `https://musicbrainz.org/recording/${id}` };
}

function escapeLucene(query: string): string {
  return query.replace(/([+\-&|!(){}\[\]^"~*?:\\/])/g, "\\$1");
}

function isMeaningfulUserAgent(value: string): boolean {
  const trimmed = value.trim();
  return /^[^/\s]+\/[^\s]+\s+\(.+\)$/.test(trimmed) && !/your-contact|example\.com/i.test(trimmed);
}

function isMbid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function assertPage(limit: number, offset: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > 25 || !Number.isInteger(offset) || offset < 0 || offset > 100_000) {
    throw invalidInput("MusicBrainz pagination is out of range.");
  }
}

function invalidInput(message: string): ProviderError {
  return new ProviderError({ code: "INVALID_INPUT", message, status: 400 });
}
