import { useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

/** Read the currently-applied theme straight from the DOM (set by the
 *  anti-FOUC inline script in index.html before React mounts). */
function readDomTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** Apply a theme: toggles the `.dark` class on <html>, persists to
 *  localStorage, updates the meta theme-color tag, and notifies other
 *  hook instances via a custom event. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* private mode — fine */
  }
  // Keep mobile browser chrome in sync.
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = theme === "dark" ? "#0a0a0f" : "#ffffff";
  window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readDomTheme);

  // Listen for changes from other hook instances or system preference flips.
  useEffect(() => {
    const onChange = (e: Event) => {
      const next = (e as CustomEvent<Theme>).detail ?? readDomTheme();
      setThemeState(next);
    };
    window.addEventListener("themechange", onChange as EventListener);
    return () =>
      window.removeEventListener("themechange", onChange as EventListener);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    applyTheme(t);
    setThemeState(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme };
}
