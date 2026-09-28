"use client";

import Link from "next/link";
import { useState } from "react";

import { SavedTrackRow } from "@/features/library/saved-track-row";
import rowStyles from "@/features/library/saved-track-row.module.css";
import { useSavedLibrary } from "@/features/library/saved-library-provider";

import styles from "./recent-saves.module.css";

const PREVIEW_LIMIT = 3;

export function RecentSaves() {
  const { records, loading, busyCodes, remove } = useSavedLibrary();
  const [message, setMessage] = useState("");

  if (loading || records.length === 0) return null;

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
    <section className={styles.section} aria-labelledby="recent-saved">
      <div className={styles.header}>
        <h2 id="recent-saved">Recently saved</h2>
        <Link href="/saved">View all</Link>
      </div>
      <span className={styles.live} role="status" aria-live="polite">{message}</span>
      <div className={rowStyles.list}>
        {records.slice(0, PREVIEW_LIMIT).map((record) => (
          <SavedTrackRow
            key={record.key}
            record={record}
            busy={busyCodes.has(record.key)}
            onRemove={() => void removeCode(record.code, record.trackName)}
          />
        ))}
      </div>
    </section>
  );
}
