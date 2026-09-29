# Implementation plan

Phase 0 specification completed 2026-09-28. Implementation phases remain pending. Work in order except where the dependencies below explicitly allow independent UI fixtures. A live-provider block does not prevent domain/mock implementation; it does prevent claiming end-to-end readiness.

## Phase 0 - Specification

- [x] Capture confirmed requirements and exclusions with R01-R14.
- [x] Define UI, domain model, storage, matching, API and architecture.
- [x] Define credential setup and document current provider restrictions with sources.
- [x] Ask about Spotify access; user answered not created/unsure.
- [x] Record decisions, defaults and unresolved launch prerequisites.
- [x] Define tests, phase gates and release checks.
- [x] Review documentation links and cross-document consistency.

Output: README, AGENTS and eleven docs. Gate: specification is coherent and enough to start Phase 1. Live API validation and app creation are Phase 2 prerequisites, not completed work. Public distribution approval remains a launch gate.

## Phase 1 - Application foundation

Depends on Phase 0. Covers R01-R02/R08/R13.

- [x] Inspect current code and package compatibility; establish supported Node version and lockfile.
- [x] Add strict validation/test tooling and scripts; preserve existing prototype until new shell works.
- [x] Establish server-only boundary, feature folders, route layouts and environment schema.
- [x] Implement mobile-first tokens, typography, bottom navigation, visible instruction, search field and category controls; enhance tablet then desktop.
- [x] Build reusable track/entity row, code control, skeleton, notice, empty and error components with synthetic test fixtures only.

Gate: install, lint, types, build and shell tests pass; mobile 320/390 review is recorded before tablet/desktop and keyboard review. No fixture can be mistaken for live production data.

## Phase 2 - Provider infrastructure and capability spike

Depends on Phase 1. Enables R03-R06/R11-R14.

- [x] Create/configure Spotify app and a contactable MusicBrainz User-Agent outside source control.
- [x] Implement Spotify Client Credentials and adapters; execute relevant live capability checks.
- [x] Implement MusicBrainz adapter, scheduler and bounded fallback.
- [x] Implement schema validation, typed errors, timeout/cooldown/retry handling.
- [x] Add memory development adapters and prototype Redis adapters for shared infrastructure; session adapters are now obsolete under the no-login decision.
- [x] Verify single-process pacing/cache behavior; real multi-worker Redis verification is explicitly deferred to Phase 9.
- [x] Record app mode, verified endpoints and any restricted capabilities in Decisions.

Gate: catalog token, provider search types, exact track, album metadata, and MusicBrainz tested live. The user deferred Redis verification. Playlist item access through Client Credentials was later recorded as HTTP 401 and playlists were removed by D21. If credentials are absent, mark provider implementation mock-verified only. Do not fabricate a pass.

## Phase 3 - Unified search

Depends on provider contracts; may develop with mocks during Phase 2. Covers R03-R05/R13. Songs and Albums are implemented. Playlist search was added then removed by D21.

- [x] Build `/api/v1/search` and domain entity normalizers.
- [x] All and category results for Songs and Albums across domain, API, service, UI and cursors.
- [x] Submit only on Search or Enter; typing alone does not navigate or call providers. Signed daily Spotify allowance and stale-request protection remain.
- [x] Add signed cursors, category Load more, provider partial states and navigation restoration.
- [x] Keep prior useful results while loading without mislabelling them as the current query.

Gate: query races, pagination and category isolation tests pass for Songs and Albums; partial failures are visible. Playlist expansion is superseded by D21.

## Phase 4 - Name-only catalog search

Depends on Phase 2/3. Covers R03, R07, R08 and R14. R06 is retired.

- [x] Implement the input classifier and shared ISRC normalizer/formatter.
- [x] Reject ISRC codes and Spotify or other URLs/URIs before any provider call.
- [x] Conservative match/merge and ranking for catalog songs.
- [x] Build the individual copy control and manual clipboard fallback.
- [x] Catalog search accepts a track, artist or album name only.

Gate: catalog search never calls providers for a code or link; copy still writes only `isrc:CODE`. Missing and failed states stay distinct.

## Phase 5 - Entity detail views

Depends on Phase 3/4. Covers R11-R13. Playlist detail is superseded by D21.

- [x] Album metadata and complete ordered tracks.
- [x] Hydrate album recordings through exact track IDs with bounded concurrency.
- [x] Playlist routes, APIs and adapter methods removed after live application-token item access returned HTTP 401.

Gate: album journey passes. Playlist discovery is out of scope. Artist browsing and end-user authorization are out of scope.

## Phase 6 - Local saved ISRCs

Depends on domain types and copy controls. Covers R10. R09 is retired by D21.

- [x] Implement the IndexedDB saved-code repository and validator.
- [x] Import legacy saved records without data loss; retain unresolved legacy entries in migration metadata.
- [x] Saved-code search, newest-first order, remove, copy and per-track save toggles are implemented.
- [x] Handle full/denied saved storage, repeatable migration and cross-tab saved-library updates.
- Cancelled: local search history. The History nav and page are removed; searches are not recorded.

Gate: reload/offline-after-load/migration tests pass; no provider login needed to read or copy saved codes.

## Phase 7 - No-login architecture cleanup

Depends on the no-login architecture. Playlist search and detail were later removed by D21.

- [x] Remove dormant session infrastructure, OAuth configuration placeholders and the separate connection placeholder during cutover.
- [x] Rename `AUTH_SECRET` to `CURSOR_SIGNING_SECRET`. Accept `AUTH_SECRET` when the new name is absent.
- [x] Verify that no login, callback, logout or user-token surface remains in source, client bundles or documentation.

Gate: the application uses Client Credentials only and exposes no end-user login flow.

## Phase 8 - Quality and cutover

Depends on Phases 1-7.

- [x] Execute the automated testing strategy and security controls (CSP, provider error fixtures, shared in-flight, clipboard).
- [x] Review keyboard use, mobile/tablet/desktop layouts, reduced motion, overflow, and Copy ISRC placement. A manual screen-reader pass remains before public release.
- [x] Confirm no popular/chart or scraping routes remain in the active app.
- [x] Confirm the production service worker does not cache API responses.
- [x] Update README and `.env.example` to the implemented commands and configuration.

Gate: unit/integration/E2E, lint, typecheck and build pass with recorded evidence; legacy data preserved; user requirements traced to tests.

## Phase 9 - Deployment and release

Depends on Phase 8 and confirmed provider access for intended audience.

- [ ] Select Node hosting/Redis/domain; configure HTTPS and secrets.
- [ ] Run real multi-worker Redis pacing, rate-limit and cache-isolation tests.
- [ ] Confirm allowed Spotify launch mode; restricted beta and public release are distinct.
- [ ] Review provider attribution/content retention and MusicBrainz commercial terms if applicable.
- [ ] Validate application-token isolation and service worker behavior.
- [ ] Run smoke tests, redacted observability and rollback rehearsal.
- [ ] Record release evidence and known limitations.

Gate: production search, copy and local persistence are verified. Public launch remains blocked if provider access is insufficient, even if software tests pass.

## Evidence register

| Date | Phase | Evidence | Status |
| --- | --- | --- | --- |
| 2026-09-28 | 0 | Thirteen Markdown files; provider documentation review; Spotify access answer; local link/scope consistency check | Specification complete |
| 2026-09-28 | 1 | Git initialized on `main`; Node 24/npm 11 lockfile; lint, strict types, production build and 11 unit tests passed; 12 Chromium journeys passed at 320px, 390px, 768px and desktop, including keyboard submission; screenshots reviewed mobile first; production dependency audit found no vulnerabilities | Implemented and locally verified |
| 2026-09-28 | 2 | 24 provider/domain tests; live Spotify token, four-type search, exact track ISRC, album/tracks, artist/releases and playlist metadata; live MusicBrainz search/detail/ISRC fallback; no secrets logged | Historical evidence remains valid; Redis is deferred and D18 later removed OAuth from scope |
| 2026-09-28 | 3 | Unified API and mobile-first result UI; 46 unit/component tests cover query races, signed cursors, pagination, category isolation, provider merging and partial failures; 12 Chromium journeys passed at 320px, 390px, tablet and desktop; lint, strict types and production build passed | Implemented and mock-verified; a repeat live smoke was blocked by current outbound provider connectivity, while Phase 2 live adapter evidence remains valid |
| 2026-09-28 | 3 / 5 scope revision | Search narrowed to All/Songs/Albums; in-app album route/API loads all track pages and hydrates exact track IDs with concurrency three; 48 unit/component tests and 16 Chromium journeys passed across mobile/tablet/desktop; production build, lint and strict types passed | Historical evidence remains valid; D18 later moved playlist work into Phases 3 and 5 |
| 2026-09-28 | 6 saved codes | Code-specific IndexedDB saves, minimal validated snapshots, memory fallback, legacy import, cross-tab invalidation, save toggles on search/album tracks and Saved search, newest-first order, copy and remove | Saved-ISRC portion implemented. History cancelled by D21 |
| 2026-09-28 | Scope reconciliation | End-user Spotify login removed; playlist discovery later added then removed after live item access returned HTTP 401 | Historical; superseded by D21 |
| 2026-09-28 | Baseline audit | Strict types, production build and 56 unit/component tests pass; lint fails on `measure-copy-btn.cjs`; the browser run reused a development server after a production build and produced 4/20 passes, so it requires a clean-server rerun | Baseline is not ready for a new implementation phase |
| 2026-09-28 | Baseline stabilization | Removed measurement artifacts from shipped scope; excluded the preserved `dummy project` reference and isolated `.next-e2e` output; fixed the save-toggle journey assertion; lint, strict types, production build, 56 unit/component tests and 20 Chromium journeys passed across mobile, tablet and desktop; the E2E runner now owns and cleans up its dedicated production server | Locally verified; changes intentionally left uncommitted at the user's request |
| 2026-09-28 | 4 name-only search | Catalog search rejects ISRCs and Spotify or other URLs/URIs before any provider call; placeholder and results copy ask for a track, artist or album name; copy of `isrc:CODE` from results remains | Implemented and mock-verified. R06 is retired. Conservative ranking was completed in Phase 8 |
| 2026-09-28 | 5 playlist detail | In-app playlist metadata plus Client Credentials item access; live smoke recorded restricted `/items` (HTTP 401) | Historical. Superseded by D21: playlists removed from the product |
| 2026-09-28 | D21 cutover | Playlists and History removed; search is All / Songs / Albums; sessions and OAuth env leftovers deleted; `CURSOR_SIGNING_SECRET` with `AUTH_SECRET` fallback; lint, strict types, production build, 77 unit/component tests and 28 Chromium journeys passed at 320px, 390px touch, 768px and desktop | Implemented and locally verified. Phase 7 complete. Next is Phase 8 after user instruction |
| 2026-09-28 | 8 installable website | Manifest name InstaMusic Finder, Apple web-app metadata, opaque PNG icons, production-only passthrough service worker. The in-app Install/Dismiss bar was removed. lint, strict types, production build, unit/component tests and Chromium journeys | Implemented and locally verified. iPhone Share-sheet installation was not clicked. A manual screen-reader pass remains before public release. Phase 9 stays unchecked |

For the detailed continuation sequence, current code discrepancies and fresh-chat handoff, see [Project handoff and remaining implementation plan](PROJECT_HANDOFF_AND_REMAINING_PLAN.md).

Next action after user instruction: begin Phase 9 deployment only if the user asks. Do not start hosting, Redis, or public launch until then.
