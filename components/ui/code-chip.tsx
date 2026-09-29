"use client";

import { Icon } from "./icon";
import { useCopyIsrc } from "./use-copy-isrc";
import styles from "./code-chip.module.css";

export function CodeChip({ code, trackName }: { code: string; trackName: string }) {
  const { value, status, copy } = useCopyIsrc(code);

  return (
    <div className={styles.wrapper}>
      <button className={styles.button} type="button" onClick={() => void copy()} aria-label={`Copy ${value} for ${trackName}`}>
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
