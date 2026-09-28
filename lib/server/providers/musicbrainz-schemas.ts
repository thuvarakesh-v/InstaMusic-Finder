import { z } from "zod";

const mbidSchema = z.uuid();
const artistCreditSchema = z.object({
  name: z.string().optional(),
  artist: z.object({ id: mbidSchema, name: z.string() }).optional(),
});

const releaseSchema = z.object({
  id: mbidSchema,
  title: z.string(),
  date: z.string().optional(),
});

export const musicBrainzRecordingSchema = z.object({
  id: mbidSchema,
  title: z.string(),
  length: z.number().int().nonnegative().nullable().optional(),
  score: z.number().int().optional(),
  isrcs: z.array(z.string()).optional(),
  "artist-credit": z.array(artistCreditSchema).optional(),
  releases: z.array(releaseSchema).optional(),
});

export const musicBrainzSearchSchema = z.object({
  count: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  recordings: z.array(musicBrainzRecordingSchema).default([]),
});

export type MusicBrainzRecordingPayload = z.infer<typeof musicBrainzRecordingSchema>;
