/**
 * Light/Dark theme mode. The theme is driven by `<html data-theme="light|dark">`
 * (see src/index.css token blocks). A tiny inline script in index.html applies the
 * saved value before first paint; this module is the runtime source of truth for
 * reading/toggling it. Default is light.
 */
export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'ei-theme';

export function getStoredTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'dark' || v === 'light') return v;
  } catch {
    /* localStorage unavailable */
  }
  // Fall back to whatever is on <html> (set by the index.html bootstrap), else light.
  const attr = document.documentElement.getAttribute('data-theme');
  return attr === 'dark' ? 'dark' : 'light';
}

export function applyTheme(mode: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', mode);
}

/** Apply + persist. */
export function setTheme(mode: ThemeMode): void {
  applyTheme(mode);
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/** Flip and persist; returns the new mode. */
export function toggleTheme(): ThemeMode {
  const next: ThemeMode = getStoredTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}
