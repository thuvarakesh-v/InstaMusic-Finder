import "server-only";

import { readServerEnv } from "@/lib/server/env";
import { MemoryCacheStore, type CacheStore } from "@/lib/server/infra/cache";
import { ProviderError } from "@/lib/server/infra/provider-error";
import { MemoryRateLimiter, type RateLimiter } from "@/lib/server/infra/rate-limit";
import { MemoryStartScheduler, type RequestStartScheduler } from "@/lib/server/infra/scheduler";

import { MusicBrainzAdapter } from "./musicbrainz";
import { SpotifyAdapter } from "./spotify";

declare global {
  var instaMusicMemoryCache: MemoryCacheStore | undefined;
  var instaMusicMusicBrainzScheduler: MemoryStartScheduler | undefined;
  var instaMusicRateLimiter: MemoryRateLimiter | undefined;
}

export type ProviderRuntime = {
  spotify: SpotifyAdapter;
  musicbrainz: MusicBrainzAdapter;
  rateLimiter: RateLimiter;
  infrastructure: "memory";
};

export async function createProviderRuntime(): Promise<ProviderRuntime> {
  const env = readServerEnv();
  if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET || !env.MUSICBRAINZ_USER_AGENT) {
    throw new ProviderError({
      code: "NOT_CONFIGURED",
      message: "Spotify and MusicBrainz provider configuration is incomplete.",
      status: 503,
    });
  }

  const infrastructure = memoryInfrastructure();
  return {
    spotify: new SpotifyAdapter(
      {
        clientId: env.SPOTIFY_CLIENT_ID,
        clientSecret: env.SPOTIFY_CLIENT_SECRET,
        market: env.SPOTIFY_MARKET,
        apiMode: env.SPOTIFY_API_MODE,
      },
      { cache: infrastructure.cache },
    ),
    musicbrainz: new MusicBrainzAdapter(env.MUSICBRAINZ_USER_AGENT, {
      cache: infrastructure.cache,
      scheduler: infrastructure.scheduler,
    }),
    rateLimiter: infrastructure.rateLimiter,
    infrastructure: infrastructure.kind,
  };
}

function memoryInfrastructure(): {
  cache: CacheStore;
  scheduler: RequestStartScheduler;
  rateLimiter: RateLimiter;
  kind: "memory";
} {
  globalThis.instaMusicMemoryCache ??= new MemoryCacheStore();
  globalThis.instaMusicMusicBrainzScheduler ??= new MemoryStartScheduler();
  globalThis.instaMusicRateLimiter ??= new MemoryRateLimiter();
  return {
    cache: globalThis.instaMusicMemoryCache,
    scheduler: globalThis.instaMusicMusicBrainzScheduler,
    rateLimiter: globalThis.instaMusicRateLimiter,
    kind: "memory",
  };
}
