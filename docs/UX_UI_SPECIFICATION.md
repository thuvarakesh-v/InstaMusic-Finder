# UX and UI specification

Target specification, 2026-09-28. Implements R01-R15 in [product requirements](PRODUCT_REQUIREMENTS.md).

## Design direction

A compact, phone-first music catalog utility for creators copying recording codes. The search field is the main content on entry. The signature element is a compact Copy Code control attached to each resolved track; it replaces any player-style primary action. The resting label does not show the code. The green brand mark combines a camera squircle, record lens, radiating grooves and code colon. Music artwork and useful metadata provide visual interest. No decorative hero, statistics, waveform animation or player bar.

## Tokens

The first visit is dark. A top-right sun/moon control switches themes and stores `dark` or `light` in this browser. The device colour scheme is not read.

| Token | Dark | Light | Role |
| --- | --- | --- | --- |
| background | #000000 | #F5F5F5 | Outer canvas |
| surface | #121212 | #FFFFFF | Main panels |
| surface-raised | #242424 | #EFEFEF | Hover and input surfaces |
| text | #FFFFFF | #141414 | Primary text |
| text-muted | #B3B3B3 | #595959 | Secondary metadata; at least 4.5:1 on the canvas |
| accent | #1DB954 | #1DB954 | Filled primary actions |
| accent-text | #1DB954 | #0D7A38 | Green text on surfaces |
| focus | #FFFFFF | #141414 | Keyboard outline |
| error | #FF8A8A | #B42318 | Failure copy |

Use dark ink on green filled buttons. Dark borders are white at 14% opacity; light borders are black at 12%. Keyboard focus is a 2px outline in the focus token, with offset. Search fields suppress that outline and show a 1px border in the text colour instead. Never communicate state through colour alone. The light canvas is a neutral gray, not cream or sand.

Typography uses the system sans for headings, controls and body, and system monospace only for a code shown after a failed copy. Do not load a separate display face. Base 16px; metadata about 13px; the idle page heading is 1.75rem, rising to 2.25rem from 768px, with letter-spacing no tighter than -0.03em. Spacing uses 4/8/12/16/24/32px, kept tight between the search field, filters and lists. Large surfaces use a 0.75rem radius. Small controls, including category filters, copy and save, use a 0.5rem radius. Circular geometry is reserved for the brand mark and recording artwork. Search, category filters, Load more and Copy Code are compact and may sit below a 44px touch target; that density was requested and should not be restored.

## Navigation and routes

| URL | Screen |
| --- | --- |
| `/` | Search entry |
| `/search?q=...&type=all` | Search results, URL-restorable query/category |
| `/albums/:id` | Spotify album + tracks |
| `/saved` | Local saved ISRC library |

Mobile is the canonical composition: compact brand header, one-column content, full-width search, category filters once a query exists, and a safe-area-aware bottom navigation for Search and Saved. On the phone the brand sits in a top bar with a Buy me a coffee link and the theme control. Tablet and desktop keep those controls in the sticky header after Search and Saved. No fixed element may obscure the final track or copy button.

The first visit on a browser shows a how-to dialog over the current page: Search the track, Copy the code, then Paste it in Instagram. The idle instruction remains underneath. Closing the dialog, Escape, or Start searching writes `instamusic-code.intro` as `seen`. There is no replay control. Visible copy says “code”, not “isrc”.

```text
Idle entry (no query):
InstaMusic Finder                       Coffee | sun/moon
Find your track, copy the code, then paste it into Instagram Music search.
[ Track, artist, or album ]
[ You can search 15 times a day. 15 remaining today. ]
Recently saved                                        View all
[art] Track / Artist / Album · year   [Copy Code] [bookmark]
Search | Saved

After a query:
[ All ] [ Songs ] [ Albums ]
Songs                                                 View all
[art] Track / Artist                  [Copy Code] [Save]
Albums
[art + title -> in-app ordered track list with individual code controls]
```

## Search behaviour

The entry instruction is visible only while no query is present. It is hidden on results and is not a dismissible wizard. Catalog search starts only when the user presses Search or Enter; typing alone does not navigate or call a provider. Under the search bar, a bordered surface card shows the remaining daily Spotify search allowance and updates after each search. On the idle home, up to three recently saved recordings appear beneath that card, newest first, with View all opening `/saved`; the preview is omitted while saved codes are loading and when none are saved. Catalog search accepts a track, artist or album name. An ISRC, Spotify URL/URI or other URL is rejected before any provider call and shown on the results surface. An explicit search button supports mobile and assistive technology.

Each browser may commit up to 15 Spotify-backed searches until 12:00 AM in that browser’s local timezone. Songs, Albums and Load more for a query that already used Spotify do not spend another of those 15. After the allowance is used, a new search still returns MusicBrainz song results and shows: “For more relevant results, try again after 12 AM.”

All, Songs and Albums appear only once a query is present. All renders two independently labelled sections with up to five initial items each. “View all” changes category and preserves query. A category view pages through ten results at a time with Load more. Artist results remain absent. Empty and failed sections are distinguished. Changing query or category cancels stale UI work, resets relevant page state and preserves URL navigation. Use links for navigations and category URLs, with an accessible current state; do not use ARIA tab semantics without implementing the full keyboard pattern.

## Track presentation

Show original square artwork without crop/overlay, full accessible title, artists, then album and year on their own line when known (`Album · year`), and duration when supplied. Copy Code sits under the artwork. The save bookmark sits at the top right of the row. Track titles are plain text: they do not open Spotify and do not copy. Do not manufacture missing metadata. Text may visually truncate but the full title must remain accessible. The resting copy control reads Copy Code and changes to Copied. It does not display the code. The accessible name, the live “Copied” announcement and the clipboard value are still exactly `isrc:CODE`.

State machine: unresolved -> resolving -> resolved / missing / retryable-error / restricted. Unresolved rows have “Find code”; resolved rows have individual copy and save buttons. Multiple provider-reported codes appear as separate code controls associated with the same recording, with source labels in expanded details. No bulk controls or numeric confidence badge. Conflict candidates remain separate results.

Copy success: brief inline “Copied” plus polite live announcement. No modal, tutorial, automatic app launch or clipboard auto-write without a user action. Clipboard failure: “Couldn’t copy. Select and copy this search code.” Show the full prefixed string as selectable text. A late copy promise must not mark a different row as copied.

## Detail screens

Album: in-app release header and complete ordered track list. Resolve each recording through its exact Spotify track ID with three-request concurrency; each resolved row uses the same Copy Code control, or shows “Code not found” or a lookup failure. A track title is plain text and does not open Spotify; only Copy Code copies the exact prefixed code and only Save toggles a bookmark.

## Saved

Saved: searchable track/artist/album/code list, ordered newest saved first, with no sort control. Rows match search results, including `Album · year` when that year was stored. Every resolved song row, including album tracks, places a green bookmark at the top right. The same filled bookmark removes an item on the Saved page. Unresolved, missing and error rows have no save action. Save applies to a specific code; repeated saves do not duplicate it. Empty copy: “No saved codes yet.” Show truthful storage-unavailable feedback.

## Accessibility and performance acceptance

Test the complete experience at 320 and 390px first, then 768px, then 1440px. At every size test 200% zoom, keyboard-only and a screen reader. Mobile failures block release even when wider screens pass. Inputs have persistent accessible names. Buttons name the target track/code. Focus returns predictably after navigation; status announcements do not repeat for every image or keystroke. Skeletons reserve dimensions and are not exposed as real items. All motion is optional, 120-180ms opacity/colour transitions, disabled with reduced motion. No animation library is needed.

Design review: the user explicitly requested the dark/green palette and selected a camera-derived logo direction. Light mode is a restrained companion with the same green actions on a neutral gray canvas. The custom record lens, grooves and code colon distinguish the mark from Instagram's official asset; do not imitate Spotify logos, add an Instagram gradient or imply official affiliation. Provider logos, when required for attribution, are used only in that role.
