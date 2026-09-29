# Engineering instructions

Read [PRODUCT_REQUIREMENTS](docs/PRODUCT_REQUIREMENTS.md), [ARCHITECTURE](docs/ARCHITECTURE.md), [IMPLEMENTATION_PLAN](docs/IMPLEMENTATION_PLAN.md) and the specialized document relevant to the task before implementation.

## Authority and scope

The user's latest explicit requirements take precedence over these documents. Product requirements own scope; Decisions records accepted engineering choices; specialized documents own their contracts. This file defines working practices and cannot override product requirements. If documents conflict, reconcile them and record the decision instead of silently picking whichever permits more features.

Working name: InstaMusic Finder. Preserve requirement IDs when updating documentation. User-requested scope changes require corresponding acceptance-criteria updates. Engineering defaults may be refined with recorded reasons without requesting approval for routine work.

## Non-negotiable behaviour

- Only copy a single validated value formatted exactly `isrc:` plus the uppercase 12-character code. Use one domain formatter everywhere. The resting control reads Copy Code and does not show the code; the accessible name, copied announcement and clipboard value stay `isrc:` plus the code.
- Initial instruction is visible on entry and hidden once a query exists. Copying shows a brief success/failure message; it does not launch a tutorial or modal workflow.
- React interface designed mobile first, tablet second and desktop third; Spotify-inspired black, charcoal, white, gray and green palette. All / Songs / Albums appear only after a query. The idle home shows the daily search allowance under the search bar, then up to three recently saved tracks (omitted when none are saved); Saved tracks remain on the Saved page.
- Preserve saved ISRCs. Catalog search accepts a track, artist or album name only; it does not look up ISRCs or Spotify links. Search starts only on Search or Enter. Each browser may use Spotify for up to 10 committed searches per 24 hours; further searches use MusicBrainz songs with a short notice.
- No region-specific availability, user success reports, charts, comparison screens, CSV import/export, bulk copy/save, playback, AI chat, team workspaces or cloud account synchronization in this release.
- No fabricated ISRCs, substituted track IDs, fabricated successful provider responses or claims of Instagram availability. Albums and artists contain recordings; they do not receive recording ISRCs themselves.
- Respect provider capability restrictions; do not add embed scraping or browser automation as an API fallback.

## Implementation conventions

- TypeScript strict mode; validate unknown network and storage payloads at boundaries with Zod. Do not rely on TypeScript casts as validation.
- Next.js App Router, React function components, CSS Modules and CSS variables. Keep server credentials in server-only modules. Client components own interaction and browser storage only.
- Write base styles for 320-767px touch screens. Add tablet enhancements at 768px and desktop enhancements at 1024px; never require hover, a wide viewport or a precision pointer for a core action.
- Thin route handlers call testable domain services. Provider adapters must not leak raw provider payloads to UI components.
- Namespaced IDs, explicit status unions, stable React keys. Prefer composition; avoid a single component owning every feature.
- Preserve unrelated user edits and legacy local data. Document migrations before changing keys. Never overwrite malformed/future-version storage automatically.
- No secrets in source, browser bundles, fixtures, logs or chat. Maintain `.env.example` with placeholders as configuration is implemented.
- Fetch paginated resources on demand. Bound concurrency and retries; cancel stale views without cancelling other clients' shared work.
- Add meaningful tests for parsing, matching, persistence, provider access states and clipboard behaviour. Reuse deterministic provider fixtures for CI.

## Verification and handoff

Existing scripts: `npm run lint`, `npm run typecheck`, `npm run build`. In Phase 1 add `npm run test` (Vitest) and `npm run test:e2e` (Playwright); do not claim these exist before adding them. Run relevant tests and checks after implementation, report any environmental blocker accurately. Documentation-only edits require link/contract/scope checks, not a production build.

Update phase checkboxes only with actual evidence. Keep specification-complete, implemented, mock-tested and live-provider-tested statuses distinct. Do not install dependencies, create accounts or deploy solely to mark Phase 0 complete. No delegation is required by this file.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
