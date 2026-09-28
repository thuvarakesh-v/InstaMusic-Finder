import "server-only";

import { z } from "zod";

const optionalSecret = z.string().trim().min(1).optional();

const serverEnvSchema = z.object({
  APP_ORIGIN: z.url().default("http://127.0.0.1:3000"),
  SPOTIFY_CLIENT_ID: optionalSecret,
  SPOTIFY_CLIENT_SECRET: optionalSecret,
  SPOTIFY_API_MODE: z.enum(["development", "extended"]).default("development"),
  SPOTIFY_MARKET: z.string().regex(/^[A-Z]{2}$/).default("US"),
  MUSICBRAINZ_USER_AGENT: optionalSecret,
  CURSOR_SIGNING_SECRET: optionalSecret,
  AUTH_SECRET: optionalSecret,
});

export type ServerEnv = {
  APP_ORIGIN: string;
  SPOTIFY_CLIENT_ID?: string;
  SPOTIFY_CLIENT_SECRET?: string;
  SPOTIFY_API_MODE: "development" | "extended";
  SPOTIFY_MARKET: string;
  MUSICBRAINZ_USER_AGENT?: string;
  CURSOR_SIGNING_SECRET?: string;
};

export function readServerEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  const parsed = serverEnvSchema.parse(source);
  return {
    APP_ORIGIN: parsed.APP_ORIGIN,
    SPOTIFY_CLIENT_ID: parsed.SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET: parsed.SPOTIFY_CLIENT_SECRET,
    SPOTIFY_API_MODE: parsed.SPOTIFY_API_MODE,
    SPOTIFY_MARKET: parsed.SPOTIFY_MARKET,
    MUSICBRAINZ_USER_AGENT: parsed.MUSICBRAINZ_USER_AGENT,
    CURSOR_SIGNING_SECRET: parsed.CURSOR_SIGNING_SECRET ?? parsed.AUTH_SECRET,
  };
}
