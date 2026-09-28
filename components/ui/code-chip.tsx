"use client";

import { useState } from "react";

import { formatInstagramSearch } from "@/lib/domain/isrc";

import { Icon } from "./icon";
import styles from "./code-chip.module.css";

export function CodeChip({ code, trackName }: { code: string; trackName: string }) {
  const value = formatInstagramSearch(code);
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("CLIPBOARD_UNAVAILABLE");
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <div className={styles.wrapper}>
      <button className={styles.button} type="button" onClick={copy} aria-label={`Copy ${value} for ${trackName}`}>
        <Icon name="copy" width="14" height="14" />
        <span>{status === "copied" ? "Copied" : "Copy Code"}</span>
      </button>
      <span className={styles.status} role="status" aria-live="polite">
        {status === "copied" ? `Copied ${value}` : status === "failed" ? "Couldn’t copy. Select and copy this search code." : ""}
      </span>
      {status === "failed" ? <code className={styles.fallback}>{value}</code> : null}
    </div>
  );
}
