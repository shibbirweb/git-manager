// Puts a color theme on the document. The built-in Git Manager themes are the
// sets in src/app.css and need nothing else; any other theme is one generated
// <style> element with that theme's variables. The <html> attributes change
// only after the new variables are in place, so watchers (themes/watch.ts)
// that copy colors out of CSS read the new ones.

import { type ColorMode, defaultThemeFor, isHighContrast, pickThemeId, themeInfo } from "./themeIndex";

const STYLE_ID = "gm-color-theme";

export interface ThemeAttributes {
  theme: ColorMode;
  colorTheme: string;
  contrast: "high" | null;
}

/** What <html> says about the applied theme; an id of the wrong mode falls back to the mode's default. */
export function themeAttributes(mode: ColorMode, themeId: string): ThemeAttributes {
  const colorTheme = pickThemeId(themeId, mode);
  const info = themeInfo(colorTheme);
  return { theme: mode, colorTheme, contrast: info && isHighContrast(info.kind) ? "high" : null };
}

/** Whether a theme needs the catalog; the defaults come from app.css. */
export function needsCatalog(mode: ColorMode, themeId: string): boolean {
  return pickThemeId(themeId, mode) !== defaultThemeFor(mode);
}

let request = 0;
/** Mode and theme last committed; settings apply often (font sliders), the theme rarely changes. */
let appliedKey: string | null = null;

function setAttribute(name: string, value: string | null): void {
  const root = document.documentElement;
  if (value === null) {
    root.removeAttribute(name);
  } else if (root.getAttribute(name) !== value) {
    root.setAttribute(name, value);
  }
}

function commit(attributes: ThemeAttributes, css: string | null): void {
  appliedKey = `${attributes.theme}:${attributes.colorTheme}`;
  let style = document.getElementById(STYLE_ID);
  if (css === null) {
    style?.remove();
  } else {
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    if (style.textContent !== css) {
      style.textContent = css;
    }
  }
  setAttribute("data-theme", attributes.theme);
  setAttribute("data-color-theme", attributes.colorTheme);
  setAttribute("data-contrast", attributes.contrast);
}

/**
 * Applies `themeId` in `mode`. The defaults apply at once; other themes after
 * the catalog loads (it is cached by the module loader after the first time).
 * A newer call wins over one still loading.
 */
export function applyColorTheme(mode: ColorMode, themeId: string): Promise<void> {
  request += 1;
  const current = request;
  const attributes = themeAttributes(mode, themeId);
  if (appliedKey === `${attributes.theme}:${attributes.colorTheme}`) {
    return Promise.resolve();
  }
  if (!needsCatalog(mode, attributes.colorTheme)) {
    commit(attributes, null);
    return Promise.resolve();
  }
  return import("./catalog")
    .then((catalog) => {
      if (current !== request) {
        return;
      }
      const css = catalog.themeCss(attributes.colorTheme);
      commit(css === null ? themeAttributes(mode, defaultThemeFor(mode)) : attributes, css);
    })
    .catch(() => {
      // The catalog failed to load: the built-in theme still works.
      if (current === request) {
        commit(themeAttributes(mode, defaultThemeFor(mode)), null);
      }
    });
}
