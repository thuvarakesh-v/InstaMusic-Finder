import styles from "./skeleton.module.css";

export function ResultSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className={styles.list} aria-label="Loading results" aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <div className={styles.row} aria-hidden="true" key={index}>
          <span className={styles.art} />
          <span className={styles.text}><i /><i /></span>
          <span className={styles.action} />
        </div>
      ))}
    </div>
  );
}
