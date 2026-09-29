# Product requirements

Version 1.0 | 2026-09-28 | Phase 0 specification | Owner: product user

## Purpose

InstaMusic Finder helps people find recording ISRCs and copy a search string for Instagram Music. The product ends at providing that string. It neither checks Instagram availability nor publishes media. It serves users globally; catalog market handling is a provider detail.

## Confirmed requirements and acceptance

| ID | Requirement | Acceptance |
| --- | --- | --- |
| R01 | React interface and working name InstaMusic Finder | Name appears in page title/header; React renders all interactive screens |
| R02 | Mobile-first React UI with Spotify-inspired palette and search structure | 320-767px is the primary design; tablet is enhanced next and desktop last; dark charcoal/black surfaces, green actions, white/gray typography; a green camera/record-code brand mark identifies the product in either theme |
| R03 | Name-only catalog search | Catalog search accepts a track, artist or album name. A raw or prefixed ISRC, Spotify URL/URI or other URL is rejected and never sent to a provider |
| R04 | Mixed search | All view presents Songs and Albums as clearly labelled sections for the same query; Artist lookup does not appear in general search |
| R05 | Category filters | All / Songs / Albums appear only once a query exists; they preserve that query, isolate the selected type and support Back navigation |
| R06 | Exact Spotify track lookup | Retired. Catalog search does not resolve pasted Spotify links |
| R07 | Individual copy | Every copy route writes exactly one `isrc:CODE`; no raw-only, duplicate prefix, whitespace, newline or list payload |
| R08 | Entry instruction | With no query, the search page displays: “Find your track, copy the code, then paste it into Instagram Music search.” The sentence is hidden once a query is present |
| R09 | Local search history | Retired. The product does not record searches or expose a History screen |
| R10 | Local saved ISRCs | A user saves a specific code with its track, can find/copy/remove it after reload; no login required |
| R11 | Album browsing | Selecting an album opens an in-app ordered track list; each resolved recording offers Copy Code, which writes that recording’s `isrc:CODE`, or a truthful missing/error state; track titles are plain text and do not open Spotify |
| R12 | No-login playlist discovery | Retired. Spotify’s application token cannot read playlist tracks; playlists are not a product surface |
| R13 | Resilient mobile-first use | Every core journey works with one hand at 320px before tablet/desktop enhancement; keyboard and touch access, explicit loading/empty/error/access states; useful results survive partial provider failure |
| R14 | Truthful results | Missing identifiers are labelled “Code not found”; provider failures are distinct from absence; no accuracy percentage or availability guarantee |
| R15 | Installable website | A production HTTPS build exposes a web app manifest named InstaMusic Finder, Apple web-app metadata, PNG home-screen icons, and a service worker that does not cache API responses. The site itself has no Install or Dismiss control |

Normal song results may display title qualifiers supplied by providers. A separate version comparison interface or invented version classifier is not required. Existing matching correctness must still be improved: do not merge unrelated recordings or rank a wrong title higher merely because it has a code.

## Deliberately excluded

Sri Lanka-specific settings/content, Instagram availability checks/reports, recently successful tracks, charts/recommendations, plain-code copying, post-copy instructional workflows, version-comparison UI, numerical confidence badges, CSV import/export, copy-all, save-all, team accounts, cloud synchronization, private notes, AI chat, playback/audio downloads, native store applications and every end-user login or Spotify OAuth flow. Earlier suggestions for these are superseded. An installable website is in scope; offline catalog search is not.

## Core journeys

1. Search a track, artist or album name -> All results -> select a recording -> copy `isrc:CODE` -> brief confirmation.
2. Search album -> open it inside InstaMusic Finder -> view its tracks and copy one recording code with Copy Code; track titles are not clickable.
3. Open Saved -> find track -> copy previously saved code without fetching a catalog first.

## Scope versus provider capabilities

General search includes Songs and Albums. Artist lookup remains excluded. Playlists are out of product scope because Spotify’s application token cannot return playlist items. The product never adds login, scraping or a fabricated empty playlist. The restriction is recorded in [provider integration](SPOTIFY_AND_MUSICBRAINZ.md) and [D21](DECISIONS.md).

## Initial engineering assumptions

Next.js supplies React plus a same-origin Node backend. Saved ISRCs use IndexedDB. The server uses Spotify Client Credentials for catalog requests and may use Redis later for shared public caches, rate limits and MusicBrainz pacing. There are no end-user sessions. No public-launch date is committed.

## Device priority

Product and QA priority is mobile phone first, tablet second, desktop third. Base markup, information order, navigation and CSS target narrow touch screens. Tablet may expose more columns and persistent brand navigation. Desktop expands density and line length without introducing a different workflow. No required action depends on hover, right-click, a wide table or a precision pointer.

## Quality targets

- Catalog search never treats a code or pasted link as a name query.
- Zero incorrect clipboard payloads in automated fixtures.
- Latest query always wins in the UI, including during rapid tab changes.
- Saved codes remain usable offline once the application shell has loaded; full offline boot is deferred unless separately verified.
- Search feedback begins immediately; skeleton shown while awaiting network. Target warm-cache responses under 500 ms and first useful uncached response under 3 seconds, measured in staging, not guaranteed provider SLAs.
- Measure correctness against a manually reviewed fixture set, successful clipboard writes, latency and error rate. Do not measure or claim Instagram success.

## Traceability

Every R-ID maps to tests in [testing strategy](TESTING_STRATEGY.md) and a phase in [implementation plan](IMPLEMENTATION_PLAN.md). This document owns scope. A phase is not complete merely because its screen renders with mock data.
