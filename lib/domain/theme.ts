export const THEME_STORAGE_KEY = "instamusic-code.theme";

export type ThemeName = "dark" | "light";

export const DEFAULT_THEME: ThemeName = "dark";

export const THEME_CANVAS: Record<ThemeName, string> = {
  dark: "#000000",
  light: "#f5f5f5",
};

export function parseTheme(value: string | null | undefined): ThemeName {
  return value === "light" ? "light" : "dark";
}

export function readStoredTheme(): ThemeName {
  try {
    return parseTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

export function writeStoredTheme(theme: ThemeName): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode or a full quota must not block switching the current view.
  }
}

export function applyTheme(theme: ThemeName): void {
  const root = document.documentElement;
  if (theme === "light") {
    root.setAttribute("data-theme", "light");
  } else {
    root.removeAttribute("data-theme");
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", THEME_CANVAS[theme]);
}

export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{if(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})==="light"){document.documentElement.setAttribute("data-theme","light");var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",${JSON.stringify(THEME_CANVAS.light)});}}catch(e){}})();`;
