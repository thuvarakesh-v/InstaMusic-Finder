import styles from "./page-header.module.css";

export function PageHeader({ title }: { title: string }) {
  return (
    <header className={styles.header}>
      <h1>{title}</h1>
    </header>
  );
}
