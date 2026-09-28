# InstaMusic Finder

InstaMusic Finder looks up a recording's ISRC and copies the exact `isrc:CODE` string used in Instagram Music search.

Search by track, artist, or album name. After a query, filter results to All, Songs, or Albums. Copy Code writes `isrc:` plus the uppercase 12-character code to the clipboard so you can paste it into Instagram Music. Save tracks on this device and reopen them from Saved. Catalog search does not accept pasted ISRCs or Spotify links.

The app talks to Spotify and MusicBrainz through a same-origin server API. Visitors never log in.

## Requirements

- Node.js 24 LTS
- npm 11+

## Local setup

Copy `.env.example` to `.env` and fill in the Spotify Client Credentials values. Set `MUSICBRAINZ_USER_AGENT` to a unique contact string.

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000`.

## Deploy

Set these environment variables on the host:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_MARKET` (defaults to `US` in `.env.example`)
- `MUSICBRAINZ_USER_AGENT`

Then:

```bash
npm ci
npm run build
npm run start
```
