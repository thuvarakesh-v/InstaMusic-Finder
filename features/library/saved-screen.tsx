"use client";

import { useMemo, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";

import { useSavedLibrary } from "./saved-library-provider";
import styles from "./saved-screen.module.css";
import { SavedTrackRow } from "./saved-track-row";
import rowStyles from "./saved-track-row.module.css";

export function SavedScreen() {
  const { records, loading, persistent, ignoredCount, busyCodes, remove } = useSavedLibrary();
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return records;
    return records.filter((record) => [record.trackName, record.artistName, record.albumName, record.code]
      .some((value) => value?.toLocaleLowerCase().includes(needle)));
  }, [query, records]);

  async function removeCode(code: string, trackName: string) {
    setMessage("");
    try {
      const result = await remove(code);
      setMessage(result.persistent ? `Removed ${trackName}.` : `Removed ${trackName} for this session.`);
    } catch {
      setMessage(`${trackName} could not be removed.`);
    }
  }

  return (
    <div className="page-stack">
      <PageHeader title="Saved Codes" />
      {!loading && !persistent ? <Notice tone="error">Browser storage is unavailable. Changes will last only for this tab session.</Notice> : null}
      {ignoredCount > 0 ? <Notice>{ignoredCount} unreadable saved {ignoredCount === 1 ? "item was" : "items were"} left untouched.</Notice> : null}
      {records.length > 0 ? (
        <label className={styles.search}>
          <span>Search saved codes</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Track, artist, album, or code" />
        </label>
      ) : null}
      <span className={styles.live} role="status" aria-live="polite">{message}</span>
      {loading ? <p className={styles.loading}>Loading saved codes…</p> : records.length === 0 ? (
        <EmptyState
          title="No saved codes yet"
          description="Tracks you save will appear here."
          actionHref="/"
          actionLabel="Find a track"
        />
      ) : visible.length === 0 ? (
        <EmptyState title="No saved codes match" description="Try a different track, artist, album, or code." />
      ) : (
        <section className={rowStyles.list} aria-label="Saved Codes">
          {visible.map((record) => (
            <SavedTrackRow
              key={record.key}
              record={record}
              busy={busyCodes.has(record.key)}
              onRemove={() => void removeCode(record.code, record.trackName)}
            />
          ))}
        </section>
      )}
    </div>
  );
}
