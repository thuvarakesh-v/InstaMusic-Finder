"use client";

import { useCallback, useSyncExternalStore } from "react";

import { Icon } from "@/components/ui/icon";
import { applyTheme, DEFAULT_THEME, readStoredTheme, writeStoredTheme, type ThemeName } from "@/lib/domain/theme";

import styles from "./theme-toggle.module.css";

const THEME_CHANGE_EVENT = "instamusic-theme-change";

function subscribe(onStoreChange: () => void): () => void {
  const onChange = () => {
    applyTheme(readStoredTheme());
    onStoreChange();
  };
  window.addEventListener("storage", onChange);
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  applyTheme(readStoredTheme());
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  };
}

function getSnapshot(): ThemeName {
  return readStoredTheme();
}

function getServerSnapshot(): ThemeName {
  return DEFAULT_THEME;
}

function labelFor(theme: ThemeName): string {
  return theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    const next: ThemeName = theme === "dark" ? "light" : "dark";
    writeStoredTheme(next);
    applyTheme(next);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, [theme]);

  return (
    <button className={styles.toggle} type="button" onClick={toggle} aria-label={labelFor(theme)}>
      <Icon name={theme === "dark" ? "moon" : "sun"} width="20" height="20" />
    </button>
  );
}
