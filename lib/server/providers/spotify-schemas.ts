import { z } from "zod";

const spotifyIdSchema = z.string().regex(/^[A-Za-z0-9]{22}$/);
const externalUrlsSchema = z.object({ spotify: z.url().optional() }).optional();
const imageSchema = z.object({
  url: z.url(),
  height: z.number().int().nullable().optional(),
  width: z.number().int().nullable().optional(),
});

export const spotifyArtistSchema = z.object({
  id: spotifyIdSchema,
  name: z.string(),
  external_urls: externalUrlsSchema,
  images: z.array(imageSchema).optional(),
});

export const spotifyAlbumSchema = z.object({
  id: spotifyIdSchema,
  name: z.string(),
  external_urls: externalUrlsSchema,
  images: z.array(imageSchema).default([]),
  artists: z.array(spotifyArtistSchema).default([]),
  release_date: z.string().optional(),
  total_tracks: z.number().int().nonnegative().optional(),
});

export const spotifyTrackSchema = z.object({
  id: spotifyIdSchema,
  name: z.string(),
  external_urls: externalUrlsSchema,
  artists: z.array(spotifyArtistSchema).default([]),
  album: spotifyAlbumSchema.optional(),
  duration_ms: z.number().int().nonnegative().optional(),
  explicit: z.boolean().optional(),
  external_ids: z.object({ isrc: z.string().optional() }).optional(),
});

const trackPageSchema = z.object({
  items: z.array(spotifyTrackSchema),
  limit: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  next: z.string().nullable().optional(),
});

const albumPageSchema = z.object({
  items: z.array(spotifyAlbumSchema),
  limit: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  next: z.string().nullable().optional(),
});

const artistPageSchema = z.object({
  items: z.array(spotifyArtistSchema),
  limit: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  next: z.string().nullable().optional(),
});

export const spotifySearchResponseSchema = z.object({
  tracks: trackPageSchema.optional(),
  albums: albumPageSchema.optional(),
  artists: artistPageSchema.optional(),
});

export const spotifyAlbumTracksSchema = trackPageSchema;
export const spotifyArtistAlbumsSchema = albumPageSchema;

export const spotifyTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.literal("Bearer"),
  expires_in: z.number().int().positive(),
});

export const cachedSpotifyTokenSchema = z.object({
  accessToken: z.string().min(1),
  expiresAt: z.number().int().positive(),
});

export type SpotifyArtistPayload = z.infer<typeof spotifyArtistSchema>;
export type SpotifyAlbumPayload = z.infer<typeof spotifyAlbumSchema>;
export type SpotifyTrackPayload = z.infer<typeof spotifyTrackSchema>;
