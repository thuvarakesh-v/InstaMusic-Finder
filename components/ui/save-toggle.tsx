"use client";

import { useState } from "react";

import { useSavedLibrary } from "@/features/library/saved-library-provider";
import type { Song } from "@/lib/domain/catalog";
import { savedKey } from "@/lib/storage/saved-schema";

import { Icon } from "./icon";
import styles from "./save-toggle.module.css";

export function SaveToggle({ song, code }: { song: Song; code: string }) {
  const { isSaved, toggle, busyCodes } = useSavedLibrary();
  const [message, setMessage] = useState("");
  const saved = isSaved(code);
  const key = savedKey(code);
  const busy = key ? busyCodes.has(key) : false;

  async function handleToggle() {
    setMessage("");
    try {
      const result = await toggle(song, code);
      setMessage(result.persistent
        ? result.saved ? "Saved on this device." : "Removed from saved codes."
        : result.saved ? "Saved for this session only. Browser storage is unavailable." : "Removed for this session.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "This code could not be saved.");
    }
  }

  return (
    <span className={styles.wrapper}>
      <button
        className={styles.button}
        type="button"
        aria-label={saved ? `Remove ${code} for ${song.name} from saved codes` : `Save ${code} for ${song.name}`}
        aria-pressed={saved}
        disabled={busy}
        onClick={handleToggle}
      >
        <Icon name="bookmark" width="16" height="16" />
      </button>
      <span className={styles.status} role="status" aria-live="polite">{message}</span>
    </span>
  );
}
