import Link from "next/link";

import { Icon } from "./icon";
import styles from "./empty-state.module.css";

type EmptyStateProps = {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
};

export function EmptyState({ title, description, actionHref, actionLabel }: EmptyStateProps) {
  return (
    <section className={styles.empty}>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {actionHref && actionLabel ? (
        <Link className={styles.action} href={actionHref}>
          {actionLabel}
          <Icon name="arrow" width="18" height="18" />
        </Link>
      ) : null}
    </section>
  );
}
