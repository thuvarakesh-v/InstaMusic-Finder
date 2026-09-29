# Testing strategy

Test outcomes, not implementation details. Synthetic fixtures and provider mocks keep continuous integration deterministic and avoid consuming live quotas. Real credential smoke tests are separate and opt-in. Never record credentials or live catalog payloads in fixtures.

## Tooling and commands

Vitest, React Testing Library and Playwright are in use. Commands: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e` and `npm run build`. Browser tests use a dedicated production build in `.next-e2e`. The production service worker does not cache API responses; tests assert that its source never writes to the Cache API and skips `/api/`. Documentation changes require internal-link and contract review only.

## Requirement coverage

| Requirement | Required evidence |
| --- | --- |
| R01-R02 | Brand/title and React shell; mobile 320/390 review before tablet/desktop; palette and contrast review |
| R03 | Parser tests for names, Unicode, rejected ISRC, rejected Spotify URL/URI and other URLs; providers are not called |
| R04-R05 | All displays Songs and Albums; filters appear only with a query, isolate those types and preserve the query; the idle home shows the daily search allowance under the search bar, then at most three recently saved tracks; category pagination and browser Back work |
| R06 | Retired; keep evidence that a pasted Spotify link is rejected rather than resolved |
| R07 | Clipboard spy equals exact 17-character prefixed value on every surface, one code only; manual fallback identical |
| R08 | Instruction visible on idle entry and hidden once a query exists; no post-copy tutorial/modal/automatic app launch |
| R09 | Retired; keep evidence that History is absent from navigation and `/history` is gone |
| R10 | Code-specific save/remove/search in newest-saved order; survives reload; no duplicate code; storage error is explicit |
| R11 | Album opens in-app; all pages preserve track order; bounded exact-track hydration; each resolved code and Spotify title link target the correct recording |
| R12 | Retired; keep evidence that no playlist route, filter or API remains and that no end-user authorization routes or tokens exist |
| R13 | Keyboard/mobile automated journeys, stale-response race, provider outage, 429; a manual screen-reader pass remains before public release |
| R14 | No fabricated code; no-match distinct from failure; no unsupported availability or confidence claims |
| R15 | Manifest named InstaMusic Finder, Apple web-app metadata, PNG icons, and a worker that skips `/api/` |

## Domain tests

Use a manually reviewed fixture table with expected recording identity, accepted codes and expected merge decisions. Cases include conflicting identifiers, repeated titles, featured artists, Unicode, requested remix, absent duration and disjoint source IDs. Rank relevance before code presence. Verify a zero-match structured filter cannot restore unrelated results. Assert every accepted raw code round-trips through formatter; malformed/repeated-prefix strings fail.

## Adapter and route integration

Mock each provider's valid, partial and nullable responses, invalid JSON, schema mismatch, oversized stream, 401, 403, 404, 429 with `Retry-After`, 5xx and timeout. Validate contract envelopes and statuses. Verify cache key isolation by market and application mode. Inject a clock for expiry and cooldown tests. Shared work survives one subscriber cancellation. MusicBrainz request starts are spaced globally across two worker instances; test with disposable Redis, not an in-memory mock alone.

Cursor tests cover valid next page, altered signature, expired cursor, query and type mismatch, and offsets that do not loop. Album simplified tracks hydrate only on demand.

## Authorization boundary tests

Verify that the application exposes no Spotify login, callback, session or logout routes. No provider token may appear in API responses, browser storage or serialized page HTML. Test coordinated Client Credentials refresh and a failed refresh.

## Persistence tests

Fresh DB, prior schema migration, legacy saved records with multiple/zero codes, malformed record, future version, migration interrupted/repeated, denied/quota-full storage and cross-tab updates. A migration leaves legacy data recoverable. Saved copy works offline when the app has loaded. A persistent write failure does not announce a durable save.

## Browser journeys

1. Search -> change query rapidly -> All -> Songs -> Load more -> copy -> save -> reload -> saved copy.
2. Paste a Spotify track URL or type an ISRC -> name-only rejection; providers are not called.
3. Search album -> open in-app -> inspect ordered tracks -> copy one code -> open a track title in Spotify -> Back to preserved search.
4. Deny storage or make a provider unavailable -> usable local library and accurate notices.
5. Home page links a web app manifest named InstaMusic Finder and Apple web-app capability metadata.

Run phone projects first at 320/390px, tablet at 768px second, and desktop at 1440px last. At every size and 200% zoom verify labels, focus, touch targets and no horizontal page overflow. A mobile failure blocks the gate regardless of wider-screen results. Automated checks cover landmarks, overflow, reduced motion, CSP, and keyboard search. A manual screen-reader review remains before public release. Mock fixture labels are visibly synthetic in development and absent in production fallback paths.

## Exit evidence

All relevant unit/integration/browser checks pass; lint/typecheck/build pass. Record command, date, commit/revision and result in implementation checklist. Failures cannot be waived by a screenshot. Public release additionally requires the live capability matrix and access review in [provider integration](SPOTIFY_AND_MUSICBRAINZ.md). No numeric coverage percentage substitutes for these behaviour checks.
