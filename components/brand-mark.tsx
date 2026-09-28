import styles from "./brand-mark.module.css";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={styles.brand} aria-label="InstaMusic Finder">
      <svg className={styles.glyph} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <rect className={styles.frame} x="6" y="6" width="52" height="52" rx="15" />
        <circle className={styles.indicator} cx="47" cy="17" r="3.5" />
        <circle className={styles.record} cx="32" cy="34" r="14.5" />
        <circle className={styles.recordCore} cx="32" cy="34" r="6.2" />
        <path className={styles.grooveCutout} d="M21 27.6c-1.7 3.6-1.7 9.2 0 12.8M24.2 30.3c-1.4 2.1-1.4 5.3 0 7.4" />
        <path className={styles.grooveCutout} d="M43 27.6c1.7 3.6 1.7 9.2 0 12.8M39.8 30.3c1.4 2.1 1.4 5.3 0 7.4" />
        <circle className={styles.codeDot} cx="32" cy="30.7" r="1.9" />
        <circle className={styles.codeDot} cx="32" cy="37.3" r="1.9" />
      </svg>
      {compact ? null : <span className={styles.wordmark}>InstaMusic Finder</span>}
    </span>
  );
}
