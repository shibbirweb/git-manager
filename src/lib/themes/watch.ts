// Code that copies colors out of CSS (xterm, mermaid) has to read them again
// when the theme changes. settings.svelte.ts always sets data-theme (also when
// following macOS) and data-color-theme on <html>, and only after the new
// variables are in place, so watching those attributes is enough.

export const THEME_ATTRIBUTES = ["data-theme", "data-color-theme", "data-contrast"];

/** Calls `onChange` after the light/dark mode or the color theme changed. */
export function watchTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(() => onChange());
  observer.observe(document.documentElement, { attributes: true, attributeFilter: THEME_ATTRIBUTES });
  return () => observer.disconnect();
}
