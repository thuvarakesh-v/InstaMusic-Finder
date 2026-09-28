"use client";

import { useEffect } from "react";

import { Notice } from "@/components/ui/notice";

import styles from "./error.module.css";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className={styles.layout}>
      <Notice tone="error">
        <h1>This page didn’t load</h1>
        <p>Try again. Your saved codes are still on this device.</p>
        <button className={styles.retry} type="button" onClick={reset}>
          Try again
        </button>
      </Notice>
    </section>
  );
}
