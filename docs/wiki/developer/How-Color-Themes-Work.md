# How color themes work

Nibtree has 41 color themes: the built-in Nibtree Light and Dark, 12 more light, 22 more dark and 5 high contrast themes. The user picks one for light mode and one for dark mode. For the user side, see [Color Themes](../usage/Color-Themes.md).

## Why we need it

People spend hours a day in an editor, and they care a lot about its colors. Most already have a favorite theme from VS Code or JetBrains, and a git client that looks different from their editor feels foreign. High contrast themes also matter for people with low vision. Picking one theme per mode, like VS Code's "preferred light and dark color theme", keeps the app right when macOS switches appearance at sunset.

## How it works

Every color in the app is a CSS variable from the UI library's `styles/colors.css`, such as `--panel`, `--text`, `--editor-bg`, `--diff-added`, `--tok-keyword` and `--term-red`. `src/lib/themes/tokens.ts` lists all 73 of them in `COLOR_TOKENS`. A theme is one value for each token.

- The **built-in themes** are the sets in `colors.css`, generated from `ui/design-tokens/colors.json`: `:root` for light, and the dark set twice, under `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` and `:root[data-theme="dark"]`. They need no JavaScript.
- **Every other theme** is one generated `<style id="gm-color-theme">` element with the rule `html:root[data-color-theme="<id>"] { ... }`. `html:root` outranks `:root[data-theme]`, and the attribute scope means the rule only applies together with its attribute.

```mermaid
sequenceDiagram
  participant P as ColorThemePicker
  participant S as settings store
  participant A as apply.ts
  participant C as catalog.ts (lazy)
  participant H as html element
  participant W as watchers (terminal, preview)
  P->>S: setColorTheme(mode, themeId)
  S->>S: setPreference, save to settings.json
  S->>A: applyColorTheme(colorMode, themeId)
  alt built-in theme
    A->>H: remove the style element
  else other theme
    A->>C: import("./catalog")
    C-->>A: themeCss(themeId)
    A->>H: write the style element
  end
  A->>H: set data-theme, data-color-theme, data-contrast
  H-->>W: MutationObserver (watch.ts)
  W->>W: read the new variables again
```

### The index and the catalog

The themes live in the UI library (`ui/web/src/lib/themes/`), and their colors are data in `ui/design-tokens/themes/`. `themeIndex.ts` is small and always loaded: every theme's `id`, `name` and `kind` from `index.json` (`light`, `dark`, `high-contrast-light`, `high-contrast-dark`). Settings validation (`pickThemeId`) and the pickers (`themeGroups`) use it without loading any palette.

`catalog.ts` is a lazy chunk with the palettes (`palettes.ts` reads the JSON files). Each `ThemeSpec` holds the theme's published colors: editor background and foreground, accent, selection, the 16 ANSI colors, syntax colors and, where the theme has them, UI colors. `deriveColors` (`derive.ts`) builds all 73 tokens from that with the helpers in `color.ts` (`mix`, `composite`, `ensureContrast`, `fitTint`):

- Hints, accent and status colors are pushed until they reach their contrast target on every surface they sit on.
- Optional syntax colors: `constant` (`true`) falls back to the keyword color, `operator` (`=`) to the text.
- Diff tints are faded (`fitTint`) until text on them stays readable.
- High contrast themes get 7:1 text targets, syntax colors pushed to 7:1 and stronger diff tints.

Values are computed on demand, never cached.

### Applying

`settings.applyAppearance()` runs on every preference change. It works out `colorMode` (`effectiveMode`: the Appearance setting, or macOS while it is System, watched with `matchMedia`) and calls `applyColorTheme(mode, themeId)` in `apply.ts`:

- `appliedKey` skips the work when mode and theme did not change, because font sliders call `applyAppearance` many times a second.
- A request counter lets the newest call win over one still loading the catalog.
- The `<html>` attributes change only after the new variables are in place, so watchers read the new colors. `data-theme` is now always set, also for System, so code reads one attribute.
- If the catalog fails to load, the built-in theme of that mode is applied.

### Who follows a theme

Most of the app reads the variables directly, so it follows at once: panels, CodeMirror (its `tok-*` classes), diffs and the merge tool. Code that copies colors out of CSS listens with `watchTheme` (`watch.ts`, a `MutationObserver` on `data-theme`, `data-color-theme` and `data-contrast`):

- The terminal (`terminalInstance.ts`) sets xterm's theme from `currentTerminalTheme()`.
- The Markdown preview redraws its diagrams. `mermaid.ts` uses mermaid's own themes for the built-ins and the theme's variables for the others.

### The picker

`views/settings/ColorThemePicker.svelte` is a listbox per mode with grouped options ("Light" or "Dark", then "High contrast"). It imports the catalog on mount for the swatches (`themeSwatch`); the swatches live in the component's state, and a `cancelled` flag ignores an import that finishes after unmount. `pickerMove` handles the arrows, Home, End and the page keys. The "In use" badge shows on the picker of `settings.colorMode`.

## Where the code lives

| File | What it does |
| --- | --- |
| `ui/design-tokens/themes/*.json` | Theme list and published colors, for every platform |
| `ui/web/src/lib/themes/themeIndex.ts` | Ids, names, kinds, defaults, modes, groups, picker keys |
| `ui/web/src/lib/themes/catalog.ts`, `palettes.ts`, `derive.ts` | Palettes, `deriveColors`, `themeCss`, `themeSwatch` |
| `ui/web/src/lib/logic/color.ts` | Parsing, mixing, WCAG contrast, Lab distance |
| `ui/web/src/lib/themes/colorTokens.ts` | The color tokens |
| `ui/design-tokens/build/themes.ts` | Every theme's colors for macOS (`GMThemes.swift`, `GMThemeColors*.swift`) |
| `src/lib/themes/apply.ts`, `watch.ts` | Putting a theme on the page; theme change watcher |
| `src/lib/stores/settings.svelte.ts` | `lightColorTheme`, `darkColorTheme`, `colorMode`, `setColorTheme` |
| `src/lib/views/settings/ColorThemePicker.svelte` | The pickers in Settings > Editor |
| `ui/web/src/lib/styles/colors.css` | The built-in themes (generated) |

## Design decisions

**Two settings, not one.** `lightColorTheme` and `darkColorTheme` follow macOS without asking. A light theme can never be saved as the dark one: `pickThemeId` falls back to the mode's default.

**Derive, do not hand-write.** 39 themes times 71 tokens would be thousands of values to keep right. Specs hold only what the theme publishes, and the derivation guarantees readable text.

**One source for every platform.** The token generator runs the same `deriveColors` and writes each theme's colors into Swift, so the native app needs no copy of the math.

**The defaults cost nothing.** The built-in themes live in `colors.css`, so the catalog chunk loads only for another theme or when Settings > Editor shows.

**Colors come from the theme's own files.** Islands Light and Dark use JetBrains' `ManyIslandsLight.theme.json`, `ManyIslandsDark.theme.json` and their editor schemes in intellij-community (selection and console colors inherited from the parent schemes). VS Code Light+ and Dark+ use `light_plus.json` and `dark_plus.json` in microsoft/vscode plus VS Code's built-in workbench defaults. Islands' rounded panels are a layout setting: see [How Rounded Panels Work](How-Rounded-Panels-Work.md). Its `--frame` token is derived here by `frameColor()`.

**Contrast is tested, not hoped for.** Every theme must pass the same checks as the built-ins.

## Known gaps

- The log graph's eight lane colors are one set for every theme (`graphLane` in `ui/design-tokens/palette.json`).
- The switch knob is hard-coded white (the library's `Switch.svelte`).
- The rich Markdown editor does not redraw its diagrams on a theme change; `richEditor.ts` has no `watchTheme`.
- At startup, `colors.css` shows the built-in theme of the macOS appearance until `settings.init()` has read settings.json, and another theme waits for the catalog chunk, so the default colors can flash.

## Tests

- `ui/web/src/lib/themes/catalog.test.ts`: every listed theme has a palette and every token. `colorsCss.test.ts`: the built-ins match `colors.css` exactly. For every theme: text at 4.5:1 (7:1 for high contrast) on the editor, panels and background, a visible selection that text stays readable on, diff tints that stand out and keep text readable, a `--frame` that stands apart from the panels, and button text at 3:1.
- `themeIndex.test.ts` (counts, unique ids, modes, `pickThemeId`, groups, `pickerMove`), `apply.test.ts` and `color.test.ts`.

## Keeping this page in sync

- A new color token goes in `colors.json`, `colorTokens.ts` and `deriveColors`; the tests fail until it does.
- A new theme goes in `THEME_INDEX` and `SPECS`, then in the list on [Color Themes](../usage/Color-Themes.md).
- Retake `color-theme-pickers.png`, `color-theme-dracula.png`, `color-theme-solarized-light.png` and `color-theme-high-contrast.png` when the look changes.
- Settings keys are listed in [Settings Reference](Settings-Reference.md).

## Bugs we fixed

See [Color Theme Bugs We Fixed](Color-Theme-Bugs-We-Fixed.md).
