"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { ResultSkeleton } from "@/components/ui/skeleton";
import { albumDetailApiResponseSchema, apiErrorResponseSchema, type AlbumDetailApiResponse } from "@/lib/domain/search-contract";

import { EntityRow } from "./entity-row";
import styles from "./album-screen.module.css";

export function AlbumScreen({ albumId }: { albumId: string }) {
  const router = useRouter();
  const [response, setResponse] = useState<AlbumDetailApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/v1/albums/${encodeURIComponent(albumId)}`, { cache: "no-store", signal: controller.signal })
      .then(async (result) => {
        const payload: unknown = await result.json().catch(() => null);
        if (!result.ok) {
          const parsed = apiErrorResponseSchema.safeParse(payload);
          throw new Error(parsed.success ? parsed.data.error.message : "These album tracks didn’t load. Try again.");
        }
        const parsed = albumDetailApiResponseSchema.safeParse(payload);
        if (!parsed.success) throw new Error("Album tracks came back in a form this app couldn’t read. Try again.");
        return parsed.data;
      })
      .then((next) => {
        if (controller.signal.aborted) return;
        setResponse(next);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "These album tracks didn’t load. Try again.");
      });
    return () => controller.abort();
  }, [albumId, attempt]);

  if (!response && !error) return <div className={styles.screen}><ResultSkeleton count={8} /></div>;
  if (!response) {
    return (
      <div className={styles.screen}>
        <button className={styles.back} type="button" onClick={() => router.back()}>← Back to search</button>
        <EmptyState title="This album didn’t load" description={error ?? "Try again."} />
        <button className={styles.retry} type="button" onClick={() => { setError(null); setAttempt((value) => value + 1); }}>Try again</button>
      </div>
    );
  }

  const { album, tracks } = response.data;
  const artists = album.artists.map((artist) => artist.name).join(", ") || "Unknown artist";
  const trackLabel = `${tracks.length} ${tracks.length === 1 ? "track" : "tracks"}`;
  return (
    <div className={styles.screen}>
      <button className={styles.back} type="button" onClick={() => router.back()}>← Back to search</button>
      <header className={styles.header}>
        <span className={styles.art} aria-hidden="true">
          {album.imageUrl ? <Image alt="" src={album.imageUrl} width={144} height={144} unoptimized priority /> : "A"}
        </span>
        <div>
          <h1 title={album.name}>{album.name}</h1>
          <p>{artists}{album.releaseDate ? ` · ${album.releaseDate.slice(0, 4)}` : ""} · {trackLabel}</p>
        </div>
      </header>
      {response.meta.partial ? <Notice>Some track codes didn’t resolve.</Notice> : null}
      {tracks.length === 0 ? <EmptyState title="No tracks found" description="Spotify didn’t list any tracks for this album." /> : (
        <section aria-labelledby="album-track-heading">
          <h2 className={styles.trackHeading} id="album-track-heading">Tracks</h2>
          <div className={styles.trackList}>
            {tracks.map((track) => {
              const code = track.isrcs[0]?.code;
              const badge = track.isrcState === "missing" ? "Code not found" : track.isrcState === "error" ? "Lookup failed" : "Code not ready";
              return (
                <EntityRow
                  key={track.id}
                  name={track.name}
                  subtitle={track.artists.map((artist) => artist.name).join(", ") || artists}
                  kind="song"
                  imageUrl={album.imageUrl}
                  isrc={code}
                  badge={code ? undefined : badge}
                  song={track}
                />
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
