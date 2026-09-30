# Decisions and prerequisites

Version 1.0, 2026-09-28. User instructions own product scope. This log records reasons and defaults; it does not supersede later user instructions or grant deployment authority.

## D01 - Product and copy format (confirmed)

Working name InstaMusic Finder. Primary outcome is an individual recording search string for Instagram Music. Only `isrc:CODE` is copied, including manual fallback. The user explicitly rejected bare-code copying and post-copy tutorials; the initial instruction remains visible. Consequence: one shared formatter and clipboard test invariant across all views.

## D02 - Search and identity (superseded by D18)

All view mixes Songs and Albums; users filter only by those two categories. Artist and Playlist lookup were removed from general search. Exact Spotify track-link lookup stays. Only recordings have ISRC controls. Albums open inside the application and preserve exact track identity; the separate authorized Playlist feature remains subject to provider access.

## D03 - Scope trimming (playlist and history portions superseded by D21)

Keep saved codes. Removed features are listed centrally in [product requirements](PRODUCT_REQUIREMENTS.md). Earlier assistant suggestions for CSV, plain copying, notes, bulk actions, availability reports and comparison views are not accepted scope. No mandatory confidence UI or location-specific behaviour. D21 retires local search history and Spotify playlists.

## D04 - React framework (engineering default)

Use Next.js App Router with React and a Node backend, building on the prototype. Alternative: Vite plus separate API; rejected as extra deployment/contract work without a current benefit. User required React, not a particular framework. CSS Modules with root variables keep styling simple. Palette follows user preference; frontend-design guidance informed restrained catalog layout, typography and code controls.

## D05 - Local data (engineering default)

IndexedDB with versioned repositories handles saved codes and migrations. Alternative: localStorage alone; prototype compatibility is retained through one-time import, but transactional migrations and per-record updates favour IndexedDB. No cloud sync or relational database. Saving applies to a specific ISRC; global catalog entities retain provider identities to prevent accidental record merging. The unused `history` object store remains from an earlier schema and is not written.

## D06 - Server state (partially superseded by D18)

The earlier design assigned sessions, shared cache and provider pacing to Redis in production. D18 removes sessions and end-user token encryption. Redis remains an optional later choice for shared public cache, pacing and rate counters on a multi-instance deployment.

## D07 - Provider capability profile (documented, live unverified)

User answered “Not created yet / unsure” about Spotify access on 2026-09-28. Target Development Mode initially. Reference restrictions and costs live in [provider guide](SPOTIFY_AND_MUSICBRAINZ.md). Catalogue discovery and content access are separate states. No scraping fallback. Artist pages navigate releases. Extended access may alter adapter capability but must be verified for the actual account.

## D08 - No regional feature (confirmed; technical default)

The product is global and has no country availability reporting. Retain a configurable provider market fallback, initially US from the prototype, solely because provider catalog requests require context. Account-context responses remain isolated in caches. Do not add location detection or a regional marketing page.

## D09 - Documentation authority (correction)

Earlier chat proposed AGENTS above product requirements. Correct rule: current user instructions first; product requirements define scope; Decisions records engineering choices; specialized documents own contracts; AGENTS governs working practices. No process file may override a user-approved feature requirement.

## D10 - Phase ordering (superseded by D18)

Tests start in Phase 1 and accompany every phase. The earlier plan assigned OAuth completion to Phase 7. D18 retires that work and moves playlist search and detail into Phases 3 and 5.

## D11 - Corrections to earlier examples (OAuth guidance superseded by D18)

Earlier callback and session guidance no longer applies because D18 removes end-user authorization. Do not assume removed batch or top-track endpoints work. “No ISRC found” must not hide provider failure. Exact provider terms and sources are in the integration guide.

## D12 - Device priority (confirmed 2026-09-28)

Mobile phone users are primary, tablet users secondary and desktop users third. Base markup and CSS target narrow touch screens; tablet and desktop progressively enhance density without changing core journeys. Consequence: phone acceptance runs first, bottom navigation is appropriate on mobile, and no essential control relies on hover, a wide table or precision pointing.

## D13 - Phase 2 live provider profile (verified 2026-09-28)

The configured Spotify application runs in Development Mode. Redacted live checks passed Client Credentials token acquisition, track/album/artist/playlist search, exact track metadata with ISRC, album tracks, artist releases and playlist metadata. Some mixed-query playlist slots were null even when the provider reported a nonzero total; adapters discard null entries truthfully. MusicBrainz accepted the configured User-Agent and passed recording search, recording detail and exact-ISRC fallback. This does not verify playlist items through Client Credentials, public distribution eligibility or production quota. Redis adapters are implemented and mock-tested, but no shared Redis service is configured for real two-worker verification.

## D14 - Redis verification deferred (confirmed 2026-09-28)

The user asked to keep Redis out of the current work and handle it later. Phase 3 therefore runs only on the bounded single-process memory adapters: the Redis package, runtime activation and current environment variable were removed. Low-level adapter prototypes remain dormant for future Phase 9 work, when the production design, dependency and real multi-worker pacing/rate-limit/cache-isolation verification will be reconsidered. This does not authorize a multi-instance production deployment using memory-only state.

## D15 - Search narrowed and albums open in-app (playlist scope superseded by D18, then D21)

General search exposes All, Songs and Albums. All requests Spotify track and album types only; Artist search/filter sections are removed from the API and UI. Selecting an album opens `/albums/:id` inside InstaMusic Finder, fetches all Spotify album-track pages and hydrates exact track IDs with concurrency three so each row can truthfully show its own ISRC state. Track titles still open their Spotify source. D21 later removed playlists from the product.

## D16 - Saved codes stay local and account-free (confirmed 2026-09-28)

Each resolved track row exposes an individual bookmark at the top right. Copy ISRC sits under the artwork. Saves use IndexedDB without a login or backend and are keyed by the normalized ISRC, so the same code cannot produce duplicates. Records store a validated minimal identification snapshot instead of a full provider response. This keeps the Saved page fast and usable without another catalog request while avoiding cloud account complexity; browser clearing or another device will not carry the library across. A memory-only fallback must never claim durable success.

## D17 - Compact result rows and an idle home (confirmed 2026-09-28)

The user asked for a quieter home and result rows. All, Songs and Albums appear only once a query exists. The entry instruction stays on the idle page and hides when results are showing. That idle page shows up to three recently saved tracks, newest first, with View all opening `/saved`; the block is omitted when nothing is saved. The resting copy control reads Copy ISRC and still writes `isrc:CODE`. Saved order is recently saved only; the sort control is removed. Large surfaces use a 0.75rem radius, small controls use 0.5rem, and the brand mark stays the only circle. Search, filters, Load more and Copy ISRC stay compact even when that is below a 44px target.

## D18 - No login (playlist search superseded by D21)

The product has no user account and no Spotify end-user authorization. Spotify access uses server-side Client Credentials only. It never adds OAuth, embed scraping or browser automation as a fallback. This decision supersedes the OAuth portions of D02, D06, D10, D11 and D15. D21 later removed playlists from search and detail after live application-token item access returned HTTP 401.

## D19 - Name-only catalog search (confirmed 2026-09-28; playlist wording superseded by D21)

Catalog search accepts a track, artist or album name. Artist remains absent as a result category. A raw, hyphenated or `isrc:`-prefixed code, including a malformed prefixed value, is rejected and never sent to a provider. HTTP and HTTPS URLs, including Spotify links, and `spotify:` URIs are likewise rejected. Copying `isrc:CODE` from search, album and saved results remains. The Saved page may still filter already-saved codes locally. `POST /api/v1/resolve` and public per-provider track-detail routes are not part of this release. This decision updates R03 and retires R06.

## D20 - Playlist items through Client Credentials (superseded by D21)

Selecting a playlist previously opened in-app metadata. A redacted live smoke fetched playlist metadata successfully (`access: metadata_only`) and then `GET /v1/playlists/{id}/items`, which returned HTTP 401 (`PROVIDER_AUTH_FAILED`). That evidence is why D21 removes playlists from the product. This does not authorize OAuth or scraping.

## D21 - Playlists and history removed (confirmed 2026-09-28)

Spotify’s application token cannot read playlist tracks. Playlists are removed from search, filters, routes and APIs. Catalog search is All / Songs / Albums and accepts a track, artist or album name. History is removed from the bottom bar and as a product feature; searches are not recorded. Saved ISRCs and in-app album track lists remain. Cursor signing uses `CURSOR_SIGNING_SECRET` and still accepts `AUTH_SECRET` when the new name is absent. Session stores and OAuth environment leftovers are deleted. This decision supersedes the playlist and history portions of D03, D18 and D20. R09 and R12 are retired. R10 remains.

## D22 - Content-Security-Policy without a script nonce (engineering default, 2026-09-28)

`next.config.ts` sets CSP with `default-src 'self'`, approved Spotify artwork hosts, and `'unsafe-inline'` for scripts and styles. A per-request nonce is not used because Next.js 16 nonce handling would force dynamic rendering of the app shell. This does not open `script-src` to arbitrary hosts. External catalog links keep `rel="noopener noreferrer"`. Client IP rate limits stay in-process until Phase 9 chooses a host.

## D23 - Camera/record-code brand mark (confirmed 2026-09-28)

The user selected concept F from the logo exploration. The production mark uses the existing green `#1DB954` in both themes and combines a camera squircle and upper-right indicator with a circular recording lens, paired grooves and a central colon. The mark replaces the earlier rotated-colon circle in the mobile and tablet/desktop brand surfaces, and supplies the application icon. It remains monochrome, avoids Instagram's gradient and adds product-specific recording/code geometry so it does not claim official Instagram affiliation. The shipped asset is deterministic SVG rather than the generated raster reference, which contained edge artifacts at high magnification.

## D24 - Installable website as InstaMusic Finder (confirmed 2026-09-28)

The user asked for a progressive web app that is installable on Android and iOS. The product name, page titles, and installed name are InstaMusic Finder. A production-only same-origin service worker registers to satisfy installability; it does not cache API responses or documents. There is no in-app Install or Dismiss bar. Android and iOS use the browser’s own install or Add to Home Screen controls. Offline catalog search and native store applications remain excluded.

## D25 - Product name InstaMusic Finder (confirmed 2026-09-28)

The user renamed the product from InstaMusic Code to InstaMusic Finder. Page titles, brand wordmark, manifest, Apple home-screen title and documentation use the new name. IndexedDB, theme storage and leftover service-worker cache prefixes remain `instamusic-code` so existing local saved codes are not orphaned.

## D26 - First-visit how-to dialog (confirmed 2026-09-28)

The user asked for a one-time how-to on first visit, independent of saved codes. A native dialog shows three screenshots with the copy Search the track, Copy the code, and Paste it in Instagram. Visible text does not use the word isrc. Closing it stores `instamusic-code.intro` as `seen`. There is no replay control. The idle home instruction remains.

## D27 - Submit-only search and daily Spotify allowance (confirmed 2026-09-29)

The user asked to stop searching while typing, to spend Spotify only on Search or Enter, and to cap each browser at 10 committed Spotify searches per 24 hours. Songs, Albums and Load more for a granted query do not spend another of those 10. After the cap, new searches skip Spotify, keep MusicBrainz song results and show: “For more relevant results, try again in 24 hours.” The idle home instruction stays above the search bar. A Notice-matched surface card under the bar shows the remaining allowance; up to three recently saved tracks sit beneath that card, with View all opening `/saved`. The allowance is an httpOnly signed cookie; clearing it resets the count, which is accepted. D28 supersedes the cap of 10 and the rolling 24-hour window.

## D28 - Fifteen Spotify searches until local midnight (confirmed 2026-09-30)

The user raised the Spotify allowance from 10 to 15 and asked it to reset at 12:00 AM in each browser’s local timezone, including a one-time reset for browsers that already had a count. The signed cookie payload is version 2. Version 1 cookies fail validation and are treated as unused, so the next request after deploy shows 15 remaining. The browser sends its IANA timezone on search. The first committed search of the day stores that zone and the UTC instant of the next local midnight. A later timezone in the same window does not move the reset. A missing or invalid zone uses UTC only when a new window starts. After 15 committed searches, further new queries skip Spotify, keep MusicBrainz song results, and show: “For more relevant results, try again after 12 AM.” Songs, Albums and Load more for a granted query still do not spend another search. This supersedes the cap and rolling 24-hour window in D27.

## Open prerequisites

| ID | Item | Needed by | Current state / default |
| --- | --- | --- | --- |
| O01 | Spotify app, credentials and owner Premium status | Phase 2 / Phase 9 | Development Mode credentials and catalog token verified; owner subscription not independently recorded |
| O02 | Exact public launch audience and permitted quota mode | Phase 9 public launch | Unconfirmed; do not promise unrestricted public catalog access |
| O03 | Hosting, Redis service and public domain | Phase 9 | Node-capable deployment architecture; vendor open |
| O04 | Real MusicBrainz contact information and commercial-use arrangement if relevant | Phase 2 / Phase 9 | Contactable User-Agent accepted live; no claim of commercial permission |
| O05 | Spotify endpoint/field behaviour for actual application | Phase 3 / Phase 5 | Public catalog operations verified live; playlist search and metadata were historically verified; app-token item access recorded as HTTP 401, after which D21 removed playlists |

None prevents Phase 1. Do not request credentials in chat. Ask for nonsecret dashboard status or direct the user to local environment setup when required. Record subsequent decisions with date, reason, alternatives and consequences; keep older entries marked superseded rather than erasing rationale.
