import Image from "next/image";

import { CodeChip } from "@/components/ui/code-chip";
import { Icon } from "@/components/ui/icon";
import type { SavedIsrc } from "@/lib/storage/saved-schema";

import styles from "./saved-track-row.module.css";

function albumLine(record: SavedIsrc): string | null {
  if (record.albumName && record.releaseYear) return `${record.albumName} · ${record.releaseYear}`;
  return record.albumName ?? record.releaseYear ?? null;
}

export function SavedTrackRow({
  record,
  busy,
  onRemove,
}: {
  record: SavedIsrc;
  busy: boolean;
  onRemove: () => void;
}) {
  const detail = albumLine(record);
  return (
    <article className={styles.row}>
      <span className={styles.art} aria-hidden="true">
        {record.artworkUrl ? <Image src={record.artworkUrl} alt="" width={56} height={56} unoptimized /> : "S"}
      </span>
      <div className={styles.text}>
        <h2 title={record.trackName}>{record.trackName}</h2>
        <p title={record.artistName}>{record.artistName}</p>
        {detail ? <p title={detail}>{detail}</p> : null}
      </div>
      <div className={styles.copy}>
        <CodeChip code={record.code} trackName={record.trackName} />
      </div>
      <button
        className={styles.remove}
        type="button"
        aria-label={`Remove ${record.code} for ${record.trackName} from saved codes`}
        disabled={busy}
        onClick={onRemove}
      >
        <Icon name="bookmark" width="16" height="16" />
      </button>
    </article>
  );
}
