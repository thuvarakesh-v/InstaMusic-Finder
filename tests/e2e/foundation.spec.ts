import { expect, test } from "@playwright/test";

import { INTRO_SEEN, INTRO_STORAGE_KEY } from "../../lib/domain/intro";
import { isRejectedCatalogQuery, NAME_ONLY_SEARCH_MESSAGE } from "../../lib/domain/search-input";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, value);
  }, { key: INTRO_STORAGE_KEY, value: INTRO_SEEN });
  await page.route("**/api/v1/search?**", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q") ?? "";
    if (isRejectedCatalogQuery(query)) {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "UNSUPPORTED_INPUT", message: NAME_ONLY_SEARCH_MESSAGE, retryable: false, retryAfterSeconds: null },
          meta: { requestId: "fixture-request" },
        }),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(searchResponse(query)),
    });
  });
  await page.route("**/api/v1/search-allowance", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          searchesRemaining: 10,
          message: "You can search 10 times a day. 10 remaining today.",
        },
        meta: { requestId: "allowance-request" },
      }),
    });
  });
  await page.route("**/api/v1/albums/*", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(albumResponse()) });
  });
});

test("mobile-first search shell exposes the required instruction", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("searchbox", { name: "Search music" })).toHaveAttribute("placeholder", "Track, artist, or album");
  await expect(page.getByText("Find your track, copy the code, then paste it into Instagram Music search.")).toBeVisible();
  await expect(page.getByText("You can search 10 times a day. 10 remaining today.")).toBeVisible();
  await expect(page.getByText("Searches go to Spotify and MusicBrainz. Saved codes stay in this browser.")).toHaveCount(0);
  await expect(page.getByText("Catalog data from Spotify and MusicBrainz.")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Search categories" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Search" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Saved" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "History" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Playlists" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", /manifest/);
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute("content", "yes");
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content", "InstaMusic Finder");
  await expect(page.getByRole("link", { name: "Buy me a coffee" })).toHaveAttribute("href", "https://buymeacoffee.com/thuvarakesh");
  await expect(page.getByRole("link", { name: "Buy me a coffee" })).toHaveAttribute("rel", "noopener noreferrer");

  const layout = await page.evaluate(() => {
    const brand = document.querySelector('[aria-label="InstaMusic Finder"]');
    const toggle = [...document.querySelectorAll("button")].find((button) => /^Switch to (light|dark) theme$/.test(button.getAttribute("aria-label") ?? ""));
    const nav = document.querySelector('nav[aria-label="Primary navigation"]');
    return {
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      brand: brand?.getBoundingClientRect().toJSON() ?? null,
      toggle: toggle?.getBoundingClientRect().toJSON() ?? null,
      nav: nav?.getBoundingClientRect().toJSON() ?? null,
    };
  });

  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.brand).toBeTruthy();
  expect(layout.toggle).toBeTruthy();
  expect(Math.abs(layout.brand!.top - layout.toggle!.top)).toBeLessThan(12);
  if (layout.viewportWidth < 768) {
    expect(layout.nav!.bottom).toBeCloseTo(layout.viewportHeight, 0);
  } else {
    expect(layout.brand!.top).toBeLessThan(24);
  }

  await page.screenshot({ path: testInfo.outputPath("home.png"), fullPage: true });
});

test("a submitted query renders provider-shaped results and the exact Instagram code", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search music" }).fill("Synthetic query");
  await page.getByRole("button", { name: "Search music" }).click();
  await expect(page).toHaveURL(/\/search\?q=Synthetic\+query&type=all/);
  await expect(page.getByRole("navigation", { name: "Search categories" }).getByRole("link")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "Songs" })).toBeVisible();
  await expect(page.getByText("Synthetic fixture", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy isrc:USRC17607839" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save USRC17607839 for Synthetic fixture" })).toBeVisible();
});

test("a Spotify link or ISRC is rejected as a name-only search", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search music" }).fill("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC");
  await page.getByRole("button", { name: "Search music" }).click();
  await expect(page.getByRole("heading", { name: "Use a name" })).toBeVisible();
  await expect(page.getByText(NAME_ONLY_SEARCH_MESSAGE)).toBeVisible();
  await expect(page.getByText("No matching results")).toHaveCount(0);

  await page.getByRole("searchbox", { name: "Search music" }).fill("isrc:USRC17607839");
  await page.getByRole("button", { name: "Search music" }).click();
  await expect(page.getByRole("heading", { name: "Use a name" })).toBeVisible();
  await expect(page.getByText(NAME_ONLY_SEARCH_MESSAGE)).toBeVisible();
});

test("a saved track persists locally and can be copied or removed", async ({ page }) => {
  await page.goto("/search?q=Synthetic+query&type=all");
  const save = page.getByRole("button", { name: "Save USRC17607839 for Synthetic fixture" });
  await save.click();
  await expect(page.getByRole("button", { name: /Remove USRC17607839 for Synthetic fixture/ })).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(page.getByRole("button", { name: /Remove USRC17607839 for Synthetic fixture/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "Saved" }).click();
  await expect(page.getByRole("heading", { name: "Saved Codes", exact: true })).toBeVisible();
  await expect(page.getByText("Synthetic fixture", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy isrc:USRC17607839 for Synthetic fixture" })).toBeVisible();

  await page.getByRole("button", { name: /Remove USRC17607839 for Synthetic fixture/ }).click();
  await expect(page.getByText("No saved codes yet")).toBeVisible();
});

test("history and playlist destinations are gone", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "History" })).toHaveCount(0);
  const history = await page.goto("/history");
  expect(history?.status()).toBe(404);
  const playlist = await page.goto("/playlists/1234567890123456789013");
  expect(playlist?.status()).toBe(404);
});

test("the theme control switches to light and keeps that choice after reload", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(245, 245, 245)");
  await expectNoOverflowOrObscuredCopy(page);
  await page.screenshot({ path: testInfo.outputPath("home-light.png"), fullPage: true });

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("button", { name: "Switch to dark theme" })).toBeVisible();

  await page.goto("/search?q=Synthetic+query&type=all");
  await expect(page.getByRole("button", { name: /Copy isrc:USRC17607839 for Synthetic fixture/ })).toBeVisible();
  await expectNoOverflowOrObscuredCopy(page);

  await page.getByRole("link", { name: "Synthetic album" }).click();
  await expect(page.getByRole("heading", { name: "Synthetic album" })).toBeVisible();
  await expectNoOverflowOrObscuredCopy(page);
  await page.screenshot({ path: testInfo.outputPath("album-light.png"), fullPage: true });

  await page.goto("/saved");
  await expect(page.getByRole("heading", { name: "Saved Codes", exact: true })).toBeVisible();
  await expectNoOverflowOrObscuredCopy(page);
});

test("search is operable with the keyboard", async ({ page }) => {
  await page.goto("/");
  const searchbox = page.getByRole("searchbox", { name: "Search music" });
  await searchbox.focus();
  await expect(searchbox).toBeFocused();
  await page.keyboard.type("Keyboard query");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=Keyboard\+query&type=all/);
});

test("typing does not navigate until Search or Enter", async ({ page }) => {
  await page.goto("/");
  const searchbox = page.getByRole("searchbox", { name: "Search music" });
  await searchbox.click();
  await searchbox.fill("Synthetic query");
  await page.waitForTimeout(600);
  await expect(page).toHaveURL("/");
  await expect(searchbox).toBeFocused();
  await expect(page.getByText(/remaining today/i)).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=Synthetic\+query&type=all/);
  await expect(searchbox).not.toBeFocused();
});

test("copy writes the exact prefixed code from search, album, and saved", async ({ page }) => {
  await page.goto("/search?q=Synthetic+query&type=all");
  await page.getByRole("button", { name: /Copy isrc:USRC17607839 for Synthetic fixture/ }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("isrc:USRC17607839");

  await page.getByRole("link", { name: "Synthetic album" }).click();
  await page.getByRole("button", { name: /Copy isrc:USRC17607839 for Album track/ }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("isrc:USRC17607839");

  await page.goto("/search?q=Synthetic+query&type=all");
  await page.getByRole("button", { name: "Save USRC17607839 for Synthetic fixture" }).click();
  await page.getByRole("link", { name: "Saved" }).click();
  await page.getByRole("button", { name: /Copy isrc:USRC17607839 for Synthetic fixture/ }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("isrc:USRC17607839");
});

test("core screens stay usable with reduced motion and keep the last copy control clear of the bottom bar", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const home = await page.goto("/");
  expect(home?.headers()["content-security-policy"]).toContain("default-src 'self'");
  expect(home?.headers()["content-security-policy"]).toContain("worker-src 'self'");
  await expectNoOverflowOrObscuredCopy(page);

  await page.goto("/search?q=Synthetic+query&type=all");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  await expect(page.locator("img:not([alt])")).toHaveCount(0);
  await expectNoOverflowOrObscuredCopy(page);

  await page.getByRole("link", { name: "Synthetic album" }).click();
  await expect(page.getByRole("heading", { name: "Synthetic album" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Album track" })).toHaveAttribute("rel", "noopener noreferrer");
  await expectNoOverflowOrObscuredCopy(page);

  await page.goto("/saved");
  await expect(page.getByRole("heading", { name: "Saved Codes", exact: true })).toBeVisible();
  await expectNoOverflowOrObscuredCopy(page);
});

test("an album opens inside the app and its track title still links to Spotify", async ({ page }, testInfo) => {
  await page.goto("/search?q=Synthetic+query&type=all");
  await page.getByRole("link", { name: "Synthetic album" }).click();

  await expect(page).toHaveURL(/\/albums\/1234567890123456789012/);
  await expect(page.getByRole("heading", { name: "Synthetic album" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy isrc:USRC17607839 for Album track" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save USRC17607839 for Album track" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Album track" })).toHaveAttribute("href", "https://open.spotify.com/track/1234567890123456789001");
  await page.screenshot({ path: testInfo.outputPath("album.png"), fullPage: true });
});

function searchResponse(query: string) {
  const source = {
    provider: "spotify",
    id: "fixture-track",
    url: "https://open.spotify.com/track/fixture-track",
  };
  return {
    data: {
      query,
      type: "all",
      sections: {
        songs: {
          items: [{
            id: "spotify:song:fixture-track",
            kind: "song",
            name: "Synthetic fixture",
            imageUrl: null,
            sources: [source],
            artists: [{ name: "Fixture artist" }],
            album: { name: "Fixture album" },
            durationMs: 180_000,
            explicit: false,
            isrcState: "resolved",
            isrcs: [{ code: "USRC17607839", sources: [source], checkedAt: "2026-09-28T00:00:00.000Z" }],
          }],
          limit: 5,
          nextCursor: null,
          state: "ok",
          message: null,
        },
        albums: {
          items: [{
            id: "spotify:album:1234567890123456789012",
            kind: "album",
            name: "Synthetic album",
            imageUrl: null,
            sources: [{ provider: "spotify", id: "1234567890123456789012", url: "https://open.spotify.com/album/1234567890123456789012" }],
            artists: [{ name: "Fixture artist" }],
            releaseDate: "2026",
            totalTracks: 1,
          }],
          limit: 5,
          nextCursor: null,
          state: "ok",
          message: null,
        },
      },
    },
    meta: {
      requestId: "fixture-request",
      partial: false,
      providers: { spotify: "ok", musicbrainz: "ok" },
      searchesRemaining: 10,
      allowanceNotice: null,
    },
  };
}

function albumResponse() {
  const trackSource = {
    provider: "spotify",
    id: "1234567890123456789001",
    url: "https://open.spotify.com/track/1234567890123456789001",
  };
  return {
    data: {
      album: searchResponse("fixture").data.sections.albums.items[0],
      tracks: [{
        id: "spotify:track:1234567890123456789001",
        kind: "song",
        name: "Album track",
        imageUrl: null,
        sources: [trackSource],
        artists: [{ name: "Fixture artist" }],
        album: { name: "Synthetic album", spotifyId: "1234567890123456789012" },
        durationMs: 180_000,
        explicit: false,
        isrcState: "resolved",
        isrcs: [{ code: "USRC17607839", sources: [trackSource], checkedAt: "2026-09-28T00:00:00.000Z" }],
      }],
    },
    meta: { requestId: "album-request", partial: false, providers: { spotify: "ok", musicbrainz: "skipped" } },
  };
}

async function expectNoOverflowOrObscuredCopy(page: import("@playwright/test").Page) {
  const layout = await page.evaluate(() => {
    const copy = [...document.querySelectorAll("button")].find((button) => /copy isrc:/i.test(button.getAttribute("aria-label") ?? ""));
    const nav = document.querySelector('nav[aria-label="Primary navigation"]');
    const toggle = [...document.querySelectorAll("button")].find((button) => /^Switch to (light|dark) theme$/.test(button.getAttribute("aria-label") ?? ""));
    const brand = document.querySelector('[aria-label="InstaMusic Finder"]');
    const heading = document.querySelector("main h1");
    const overlap = (a: DOMRect, b: DOMRect) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      copy: copy?.getBoundingClientRect().toJSON() ?? null,
      nav: nav?.getBoundingClientRect().toJSON() ?? null,
      toggleOverlapsBrand: toggle && brand ? overlap(toggle.getBoundingClientRect(), brand.getBoundingClientRect()) : false,
      toggleOverlapsHeading: toggle && heading ? overlap(toggle.getBoundingClientRect(), heading.getBoundingClientRect()) : false,
    };
  });
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.toggleOverlapsBrand).toBe(false);
  expect(layout.toggleOverlapsHeading).toBe(false);
  if (layout.copy && layout.nav && layout.viewportWidth < 768) {
    expect(layout.copy.bottom).toBeLessThanOrEqual(layout.nav.top + 1);
  }
}

