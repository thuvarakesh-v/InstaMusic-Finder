import Image from "next/image";
import Link from "next/link";

import { CodeChip } from "@/components/ui/code-chip";
import { SaveToggle } from "@/components/ui/save-toggle";
import type { Song } from "@/lib/domain/catalog";

import styles from "./entity-row.module.css";

type EntityRowProps = {
  name: string;
  subtitle: string;
  detail?: string;
  kind: "song" | "album" | "artist";
  isrc?: string;
  imageUrl?: string | null;
  badge?: string;
  href?: string;
  song?: Song;
};

export function EntityRow({ name, subtitle, detail, kind, isrc, imageUrl, badge, href, song }: EntityRowProps) {
  const art = (
    <span className={styles.art} aria-hidden="true">
      {imageUrl ? <Image alt="" src={imageUrl} width={56} height={56} unoptimized /> : kind.slice(0, 1).toUpperCase()}
    </span>
  );
  const text = (
    <div className={styles.text}>
      <h3 title={name}>{name}</h3>
      <p title={subtitle}>{subtitle}</p>
      {detail ? <p title={detail}>{detail}</p> : null}
      {kind === "song" && isrc ? null : badge ? <p className={styles.badge}>{badge}</p> : null}
    </div>
  );
  const copy = kind === "song" && isrc ? (
    <div className={styles.copy}>
      <CodeChip code={isrc} trackName={name} />
    </div>
  ) : null;
  if (href) {
    const openLabel = kind === "album" ? `Open album ${name}` : `Open ${name}`;
    return (
      <Link className={`${styles.row} ${styles.clickable}`} href={href} aria-label={openLabel}>
        {art}
        {text}
        <span className={styles.kind}>{badge ?? kind}</span>
      </Link>
    );
  }
  return (
    <article className={`${styles.row} ${kind === "song" ? styles.song : ""}`}>
      {art}
      {text}
      {copy}
      {kind === "song" && isrc && song ? (
        <div className={styles.save}>
          <SaveToggle song={song} code={isrc} />
        </div>
      ) : kind === "song" ? null : (
        <span className={styles.kind}>{badge ?? kind}</span>
      )}
    </article>
  );
}
