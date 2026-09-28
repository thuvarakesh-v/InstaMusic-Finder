import styles from "./notice.module.css";

export function Notice({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "error" }) {
  return <div className={`${styles.notice} ${styles[tone]}`} role={tone === "error" ? "alert" : "status"}>{children}</div>;
}
