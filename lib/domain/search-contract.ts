import { z } from "zod";

import { searchCategorySchema } from "./search";

const providerRefSchema = z.object({
  provider: z.enum(["spotify", "musicbrainz"]),
  id: z.string().min(1),
  url: z.url(),
});
const artistRefSchema = z.object({
  name: z.string(),
  spotifyId: z.string().optional(),
  musicbrainzId: z.string().optional(),
});
const isrcEvidenceSchema = z.object({
  code: z.string().regex(/^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/),
  sources: z.array(providerRefSchema),
  checkedAt: z.string(),
});
const baseEntityShape = {
  id: z.string().min(1),
  name: z.string(),
  imageUrl: z.url().nullable(),
  sources: z.array(providerRefSchema).min(1),
};

export const songSchema = z.object({
  ...baseEntityShape,
  kind: z.literal("song"),
  artists: z.array(artistRefSchema),
  album: z.object({
    name: z.string(),
    spotifyId: z.string().optional(),
    releaseDate: z.string().optional(),
  }).nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  explicit: z.boolean().nullable(),
  isrcState: z.enum(["unresolved", "resolved", "missing", "error"]),
  isrcs: z.array(isrcEvidenceSchema),
});
export const albumSchema = z.object({
  ...baseEntityShape,
  kind: z.literal("album"),
  artists: z.array(artistRefSchema),
  releaseDate: z.string().nullable(),
  totalTracks: z.number().int().nonnegative().nullable(),
});
export const artistSchema = z.object({ ...baseEntityShape, kind: z.literal("artist") });

function sectionSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    limit: z.number().int().nonnegative(),
    nextCursor: z.string().nullable(),
    state: z.enum(["ok", "unavailable", "not_applicable"]),
    message: z.string().nullable(),
  });
}

const providerStateSchema = z.enum(["ok", "unavailable", "rate_limited", "not_configured", "skipped"]);

export const searchDataSchema = z.object({
  query: z.string(),
  type: searchCategorySchema,
  sections: z.object({
    songs: sectionSchema(songSchema),
    albums: sectionSchema(albumSchema),
  }),
});

export const albumDetailApiResponseSchema = z.object({
  data: z.object({
    album: albumSchema,
    tracks: z.array(songSchema),
  }),
  meta: z.object({
    requestId: z.string(),
    partial: z.boolean(),
    providers: z.object({ spotify: providerStateSchema, musicbrainz: providerStateSchema }),
  }),
});

export const searchApiResponseSchema = z.object({
  data: searchDataSchema,
  meta: z.object({
    requestId: z.string(),
    partial: z.boolean(),
    providers: z.object({ spotify: providerStateSchema, musicbrainz: providerStateSchema }),
    searchesRemaining: z.number().int().nonnegative().max(10),
    allowanceNotice: z.string().nullable(),
  }),
});

export const searchAllowanceApiResponseSchema = z.object({
  data: z.object({
    searchesRemaining: z.number().int().nonnegative().max(10),
    message: z.string().min(1),
  }),
  meta: z.object({ requestId: z.string() }),
});

export const apiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
    retryAfterSeconds: z.number().nullable(),
  }),
  meta: z.object({ requestId: z.string() }),
});

export type SearchData = z.infer<typeof searchDataSchema>;
export type SearchApiResponse = z.infer<typeof searchApiResponseSchema>;
export type SearchAllowanceApiResponse = z.infer<typeof searchAllowanceApiResponseSchema>;
export type AlbumDetailApiResponse = z.infer<typeof albumDetailApiResponseSchema>;
export type SearchSection = SearchData["sections"][keyof SearchData["sections"]];
export type ProviderState = z.infer<typeof providerStateSchema>;
