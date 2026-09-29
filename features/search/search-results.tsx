"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { ResultSkeleton } from "@/components/ui/skeleton";
import { EntityRow } from "@/features/catalog/entity-row";
import type { SearchCategory } from "@/lib/domain/search";
import { NAME_ONLY_SEARCH_MESSAGE } from "@/lib/domain/search-input";
import {
  apiErrorResponseSchema,
  searchApiResponseSchema,
  type SearchApiResponse,
  type SearchData,
} from "@/lib/domain/search-contract";

import { takeSearchCommit } from "./search-commit";
import { useSearchAllowance } from "./search-allowance";
import styles from "./search-results.module.css";

type SearchEntity =
  | SearchData["sections"]["songs"]["items"][number]
  | SearchData["sections"]["albums"]["items"][number];

const labels = {
  song: "Songs",
  album: "Albums",
} as const;

export function SearchResults({ query, category }: { query: string; category: SearchCategory }) {
  const requestKey = `${category}:${query}`;
  const { setSearchesRemaining } = useSearchAllowance();
  const [response, setResponse] = useState<SearchApiResponse | null>(null);
  const [responseKey, setResponseKey] = useState<string | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const sequence = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const currentSequence = sequence.current + 1;
    sequence.current = currentSequence;
    const commit = takeSearchCommit(query);

    void requestSearch({ query, category, commit, signal: controller.signal })
      .then((next) => {
        if (controller.signal.aborted || sequence.current !== currentSequence) return;
        setResponse(next);
        setResponseKey(requestKey);
        setError(null);
        setSearchesRemaining(next.meta.searchesRemaining);
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted || sequence.current !== currentSequence) return;
        setError({
          key: requestKey,
          message: requestError instanceof Error ? requestError.message : "Search didn’t respond. Check your connection and try again.",
        });
      });

    return () => controller.abort();
  }, [category, query, refresh, requestKey, setSearchesRemaining]);

  const visibleData = response?.data ?? null;
  const currentError = error?.key === requestKey ? error.message : null;
  const loading = responseKey !== requestKey && currentError === null;
  const showingPrevious = Boolean(visibleData && responseKey !== requestKey);
  const selectedCursor = useMemo(
    () => (visibleData && category !== "all" ? getSelectedSection(visibleData, category).nextCursor : null),
    [category, visibleData],
  );

  async function loadMore() {
    if (!selectedCursor || category === "all" || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const next = await requestSearch({ query, category, cursor: selectedCursor });
      setResponse((current) => current ? appendPage(current, next, category) : next);
      setResponseKey(requestKey);
      setSearchesRemaining(next.meta.searchesRemaining);
    } catch (requestError) {
      setError({
        key: requestKey,
        message: requestError instanceof Error ? requestError.message : "More results didn’t load. Try again.",
      });
    } finally {
      setLoadingMore(false);
    }
  }

  if (!visibleData && loading) return <ResultSkeleton count={5} />;

  if (!visibleData && currentError) {
    const nameOnly = currentError === NAME_ONLY_SEARCH_MESSAGE;
    return (
      <div className={styles.results}>
        <EmptyState
          title={nameOnly ? "Use a name" : "Search didn’t load"}
          description={currentError}
        />
        {nameOnly ? null : (
          <button className={styles.loadMore} type="button" onClick={() => {
            setError(null);
            setResponseKey(null);
            setRefresh((value) => value + 1);
          }}>Try again</button>
        )}
      </div>
    );
  }

  if (!visibleData) return null;

  const activeSections = category === "all"
    ? (["song", "album"] as const)
    : ([category] as const);
  const resultCount = activeSections.reduce((total, key) => total + getSelectedSection(visibleData, key).items.length, 0);
  const hasSectionStatus = activeSections.some((key) => {
    const section = getSelectedSection(visibleData, key);
    return section.items.length > 0 || section.state === "unavailable" || Boolean(section.message);
  });

  return (
    <section className={styles.results} aria-label="Search results" aria-busy={loading || loadingMore}>
      {showingPrevious ? (
        <Notice>
          Updating results for <strong>“{query}”</strong>. The list below is still for <strong>“{visibleData.query}”</strong>.
        </Notice>
      ) : null}
      {response?.meta.allowanceNotice ? <Notice>{response.meta.allowanceNotice}</Notice> : null}
      {response?.meta.partial ? (
        <Notice>Part of this search didn’t respond. What’s available is shown below.</Notice>
      ) : null}
      {currentError ? (
        <Notice tone="error">
          {currentError} <button className={styles.inlineAction} type="button" onClick={() => {
            setError(null);
            setResponseKey(null);
            setRefresh((value) => value + 1);
          }}>Retry</button>
        </Notice>
      ) : null}

      {resultCount === 0 && !hasSectionStatus && !loading ? (
        <EmptyState
          title="No matching results"
          description="Try the exact track title, artist name, or album."
        />
      ) : (
        <div className={styles.sections} data-stale={showingPrevious || undefined}>
          {activeSections.map((section) => (
            <ResultSection
              key={section}
              kind={section}
              query={visibleData.query}
              section={getSelectedSection(visibleData, section)}
              showAllLink={category === "all"}
            />
          ))}
        </div>
      )}

      {selectedCursor && !showingPrevious ? (
        <button className={styles.loadMore} type="button" disabled={loadingMore} onClick={loadMore}>
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      ) : null}
    </section>
  );
}

function ResultSection({
  kind,
  query,
  section,
  showAllLink,
}: {
  kind: Exclude<SearchCategory, "all">;
  query: string;
  section: ReturnType<typeof getSelectedSection>;
  showAllLink: boolean;
}) {
  if (section.state === "not_applicable" && !section.message) return null;
  return (
    <section className={styles.section} aria-labelledby={`results-${kind}`}>
      <div className={styles.sectionHeader}>
        <h2 id={`results-${kind}`}>{labels[kind]}</h2>
        {showAllLink ? (
          <Link href={`/search?q=${encodeURIComponent(query)}&type=${kind}`}>View all</Link>
        ) : null}
      </div>
      {section.message ? <Notice tone={section.state === "unavailable" ? "error" : "neutral"}>{section.message}</Notice> : null}
      {section.items.length > 0 ? (
        <div className={styles.list}>
          {section.items.map((entity) => <SearchEntityRow entity={entity} key={entity.id} />)}
        </div>
      ) : section.state === "ok" ? (
        <p className={styles.emptySection}>No {labels[kind].toLowerCase()} matched this search.</p>
      ) : null}
    </section>
  );
}

function SearchEntityRow({ entity }: { entity: SearchEntity }) {
  const source = entity.sources[0];
  if (entity.kind === "song") {
    const artists = entity.artists.map((artist) => artist.name).join(", ") || "Unknown artist";
    const year = entity.album?.releaseDate?.slice(0, 4);
    const albumName = entity.album?.name;
    const detail = albumName && year ? `${albumName} · ${year}` : albumName ?? year;
    const code = entity.isrcs[0]?.code;
    const badge = entity.isrcState === "missing"
      ? "Code not found"
      : entity.isrcState === "error"
        ? "Lookup failed"
        : entity.isrcState === "unresolved"
          ? "Code not ready"
          : undefined;
    return (
      <EntityRow
        name={entity.name}
        subtitle={artists}
        detail={detail}
        kind="song"
        isrc={code}
        imageUrl={entity.imageUrl}
        badge={badge}
        song={entity}
      />
    );
  }
  if (entity.kind === "album") {
    const artists = entity.artists.map((artist) => artist.name).join(", ") || "Unknown artist";
    const year = entity.releaseDate?.slice(0, 4);
    const albumHref = source?.provider === "spotify" ? `/albums/${source.id}` : undefined;
    return <EntityRow name={entity.name} subtitle={year ? `${artists} · ${year}` : artists} kind="album" imageUrl={entity.imageUrl} href={albumHref} />;
  }
}

function getSelectedSection(data: SearchData, category: Exclude<SearchCategory, "all">) {
  if (category === "song") return data.sections.songs;
  return data.sections.albums;
}

async function requestSearch(options: {
  query: string;
  category: SearchCategory;
  cursor?: string;
  commit?: boolean;
  signal?: AbortSignal;
}): Promise<SearchApiResponse> {
  const params = new URLSearchParams({
    q: options.query,
    type: options.category,
    limit: options.category === "all" ? "5" : "10",
  });
  if (options.cursor) params.set("cursor", options.cursor);
  if (options.commit) params.set("commit", "1");
  const response = await fetch(`/api/v1/search?${params}`, { cache: "no-store", signal: options.signal });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsedError = apiErrorResponseSchema.safeParse(payload);
    throw new Error(parsedError.success ? parsedError.data.error.message : "Search didn’t respond. Check your connection and try again.");
  }
  const parsed = searchApiResponseSchema.safeParse(payload);
  if (!parsed.success) throw new Error("Search sent a response this app couldn’t read. Try again.");
  return parsed.data;
}

function appendPage(current: SearchApiResponse, next: SearchApiResponse, category: Exclude<SearchCategory, "all">): SearchApiResponse {
  const data = structuredClone(current.data);
  if (category === "song") appendSection(data.sections.songs, next.data.sections.songs);
  if (category === "album") appendSection(data.sections.albums, next.data.sections.albums);
  return {
    data,
    meta: {
      ...next.meta,
      partial: current.meta.partial || next.meta.partial,
    },
  };
}

function appendSection<T extends { id: string }>(
  current: { items: T[]; nextCursor: string | null; state: "ok" | "unavailable" | "not_applicable"; message: string | null },
  next: { items: T[]; nextCursor: string | null; state: "ok" | "unavailable" | "not_applicable"; message: string | null },
) {
  const ids = new Set(current.items.map((item) => item.id));
  current.items.push(...next.items.filter((item) => !ids.has(item.id)));
  current.nextCursor = next.nextCursor;
  current.state = next.state;
  current.message = next.message;
}
