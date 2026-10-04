// Color theme palettes. Imported lazily (Settings > Editor, or when a
// non-default theme is active) so the defaults cost nothing. Each theme lists
// its published editor, syntax and terminal colors; the UI shades (panels,
// borders, hover, diff tints...) are derived from them with themes/color.ts.
// Values are computed on demand and never cached, so only the applied CSS
// variables stay around.

import { composite, contrastRatio, ensureContrast, fitTint, mix, withAlpha } from "./color";
import {
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  isHighContrast,
  modeOfKind,
  THEME_INDEX,
  themeInfo,
  type ThemeKind,
} from "./themeIndex";
import { COLOR_TOKENS, type ThemeColors } from "./tokens";

/** black, red, green, yellow, blue, magenta, cyan, white, then the bright variants. */
type Ansi = [string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string];

interface Syntax {
  keyword: string;
  string: string;
  number: string;
  comment: string;
  type: string;
  function: string;
  property: string;
  meta?: string;
  tag?: string;
  attr?: string;
  invalid?: string;
}

interface ThemeSpec {
  /** Editor background. */
  background: string;
  /** Editor and UI text. */
  foreground: string;
  accent: string;
  /** Editor selection; may be translucent, it is painted over the background. */
  selection: string;
  ansi: Ansi;
  syntax: Syntax;
  /** Published UI colors, where the theme has them; everything else is derived. */
  ui?: {
    bg?: string;
    panel?: string;
    panelAlt?: string;
    border?: string;
    borderStrong?: string;
    lineNumber?: string;
    activeLine?: string;
    cursor?: string;
    /** Git status and diff colors when the ANSI ones do not fit (Rosé Pine has no green). */
    success?: string;
    danger?: string;
    warning?: string;
    info?: string;
  };
}

const SHADOW_LIGHT = "0 8px 28px rgba(0, 0, 0, 0.16)";
const SHADOW_DARK = "0 8px 28px rgba(0, 0, 0, 0.5)";

/** The light set in src/app.css (a test keeps the two in sync). */
const GM_LIGHT: ThemeColors = {
  "--bg": "#f7f8fa",
  "--panel": "#ffffff",
  "--panel-alt": "#f2f3f5",
  "--border": "#ebecf0",
  "--border-strong": "#dfe1e5",
  "--text": "#1e1f22",
  "--text-dim": "#6c707e",
  "--text-faint": "#a8adbd",
  "--accent": "#3574f0",
  "--accent-hover": "#2d66d9",
  "--accent-text": "#ffffff",
  "--hover": "#eceef2",
  "--selected": "#d4e2ff",
  "--selected-inactive": "#e4e6eb",
  "--danger": "#db3b4b",
  "--success": "#208a3c",
  "--warning": "#c27d04",
  "--shadow": SHADOW_LIGHT,
  "--overlay": "rgba(0, 0, 0, 0.28)",
  "--editor-bg": "#ffffff",
  "--editor-gutter": "#ffffff",
  "--editor-line-number": "#aeb3c2",
  "--editor-active-line": "#f5f8fe",
  "--editor-selection": "#a6d2ff",
  "--editor-cursor": "#1e1f22",
  "--term-background": "#ffffff",
  "--term-foreground": "#1e1f22",
  "--term-cursor": "#1e1f22",
  "--term-selection": "#a6d2ff",
  "--term-black": "#000000",
  "--term-red": "#cd3131",
  "--term-green": "#00bc00",
  "--term-yellow": "#949800",
  "--term-blue": "#0451a5",
  "--term-magenta": "#bc05bc",
  "--term-cyan": "#0598bc",
  "--term-white": "#555555",
  "--term-bright-black": "#666666",
  "--term-bright-red": "#cd3131",
  "--term-bright-green": "#14ce14",
  "--term-bright-yellow": "#b5ba00",
  "--term-bright-blue": "#0451a5",
  "--term-bright-magenta": "#bc05bc",
  "--term-bright-cyan": "#0598bc",
  "--term-bright-white": "#a5a5a5",
  "--term-scrollbar": "rgba(108, 112, 126, 0.35)",
  "--term-scrollbar-hover": "rgba(108, 112, 126, 0.55)",
  "--diff-modified": "rgba(53, 116, 240, 0.13)",
  "--diff-modified-edge": "#6f9cf5",
  "--diff-added": "rgba(76, 175, 80, 0.16)",
  "--diff-added-edge": "#6cbf70",
  "--diff-deleted": "rgba(128, 128, 140, 0.16)",
  "--diff-deleted-edge": "#a1a3ab",
  "--diff-conflict": "rgba(229, 87, 101, 0.15)",
  "--diff-conflict-edge": "#e06c78",
  "--diff-inline": "rgba(53, 116, 240, 0.28)",
  "--tok-keyword": "#0033b3",
  "--tok-string": "#067d17",
  "--tok-number": "#1750eb",
  "--tok-comment": "#8c8c8c",
  "--tok-type": "#008080",
  "--tok-function": "#00627a",
  "--tok-property": "#871094",
  "--tok-meta": "#9e880d",
  "--tok-tag": "#0033b3",
  "--tok-attr": "#174ad4",
  "--tok-invalid": "#f50000",
  "--bracket-1": "#0431fa",
  "--bracket-2": "#319331",
  "--bracket-3": "#7b3814",
};

/** The dark set in src/app.css (a test keeps the two in sync). */
const GM_DARK: ThemeColors = {
  "--bg": "#1e1f22",
  "--panel": "#2b2d30",
  "--panel-alt": "#25272a",
  "--border": "#1e1f22",
  "--border-strong": "#393b40",
  "--text": "#dfe1e5",
  "--text-dim": "#8c9099",
  "--text-faint": "#5f636b",
  "--accent": "#3574f0",
  "--accent-hover": "#2d66d9",
  "--accent-text": "#ffffff",
  "--hover": "#393b40",
  "--selected": "#2e436e",
  "--selected-inactive": "#393b40",
  "--danger": "#f06470",
  "--success": "#5fb865",
  "--warning": "#e3a64b",
  "--shadow": SHADOW_DARK,
  "--overlay": "rgba(0, 0, 0, 0.45)",
  "--editor-bg": "#1e1f22",
  "--editor-gutter": "#1e1f22",
  "--editor-line-number": "#4b5059",
  "--editor-active-line": "#26282e",
  "--editor-selection": "#214283",
  "--editor-cursor": "#dfe1e5",
  "--term-background": "#1e1f22",
  "--term-foreground": "#dfe1e5",
  "--term-cursor": "#dfe1e5",
  "--term-selection": "#214283",
  "--term-black": "#000000",
  "--term-red": "#cd3131",
  "--term-green": "#0dbc79",
  "--term-yellow": "#e5e510",
  "--term-blue": "#2472c8",
  "--term-magenta": "#bc3fbc",
  "--term-cyan": "#11a8cd",
  "--term-white": "#e5e5e5",
  "--term-bright-black": "#666666",
  "--term-bright-red": "#f14c4c",
  "--term-bright-green": "#23d18b",
  "--term-bright-yellow": "#f5f543",
  "--term-bright-blue": "#3b8eea",
  "--term-bright-magenta": "#d670d6",
  "--term-bright-cyan": "#29b8db",
  "--term-bright-white": "#e5e5e5",
  "--term-scrollbar": "rgba(140, 144, 153, 0.35)",
  "--term-scrollbar-hover": "rgba(140, 144, 153, 0.55)",
  "--diff-modified": "rgba(53, 116, 240, 0.2)",
  "--diff-modified-edge": "#4a78d6",
  "--diff-added": "rgba(84, 170, 84, 0.2)",
  "--diff-added-edge": "#4e9a52",
  "--diff-deleted": "rgba(120, 122, 130, 0.25)",
  "--diff-deleted-edge": "#6e7078",
  "--diff-conflict": "rgba(229, 87, 101, 0.2)",
  "--diff-conflict-edge": "#b8505b",
  "--diff-inline": "rgba(80, 140, 255, 0.35)",
  "--tok-keyword": "#cf8e6d",
  "--tok-string": "#6aab73",
  "--tok-number": "#2aacb8",
  "--tok-comment": "#7a7e85",
  "--tok-type": "#16baac",
  "--tok-function": "#56a8f5",
  "--tok-property": "#c77dbb",
  "--tok-meta": "#b3ae60",
  "--tok-tag": "#d5b778",
  "--tok-attr": "#bababa",
  "--tok-invalid": "#fa6675",
  "--bracket-1": "#ffd700",
  "--bracket-2": "#da70d6",
  "--bracket-3": "#179fff",
};

/** VS Code's default terminal colors, for themes that publish none. */
const VSCODE_ANSI_LIGHT: Ansi = [
  "#000000", "#cd3131", "#00bc00", "#949800", "#0451a5", "#bc05bc", "#0598bc", "#555555",
  "#666666", "#cd3131", "#14ce14", "#b5ba00", "#0451a5", "#bc05bc", "#0598bc", "#a5a5a5",
];

const VSCODE_ANSI_DARK: Ansi = [
  "#000000", "#cd3131", "#0dbc79", "#e5e510", "#2472c8", "#bc3fbc", "#11a8cd", "#e5e5e5",
  "#666666", "#f14c4c", "#23d18b", "#f5f543", "#3b8eea", "#d670d6", "#29b8db", "#e5e5e5",
];

/** JetBrains' console colors: the Default (light) and Darcula editor schemes, which the Islands schemes inherit. */
const JETBRAINS_ANSI_LIGHT: Ansi = [
  "#000000", "#c91b00", "#00a000", "#a68a0d", "#0225c7", "#a771bf", "#00a3a3", "#808080",
  "#595959", "#f0524f", "#4fc414", "#c7a600", "#3993d4", "#c930c7", "#00b0b0", "#ffffff",
];
const DARCULA_ANSI: Ansi = [
  "#000000", "#ff6b68", "#a8c023", "#d6bf55", "#5394ec", "#ae8abe", "#299999", "#999999",
  "#555555", "#ff8785", "#a8c023", "#ffff00", "#7eaef1", "#ff99ff", "#6cdada", "#ffffff",
];

const SPECS: Record<string, ThemeSpec> = {
  "github-light": {
    background: "#ffffff",
    foreground: "#1f2328",
    accent: "#0969da",
    selection: "rgba(9, 105, 218, 0.22)",
    ansi: [
      "#24292f", "#cf222e", "#116329", "#4d2d00", "#0969da", "#8250df", "#1b7c83", "#6e7781",
      "#57606a", "#a40e26", "#1a7f37", "#633c01", "#218bff", "#a475f9", "#3192aa", "#8c959f",
    ],
    syntax: {
      keyword: "#cf222e", string: "#0a3069", number: "#0550ae", comment: "#6e7781", type: "#953800",
      function: "#8250df", property: "#0550ae", meta: "#953800", tag: "#116329", attr: "#0550ae", invalid: "#82071e",
    },
    ui: { bg: "#f6f8fa", panelAlt: "#f6f8fa", border: "#d8dee4", borderStrong: "#d0d7de", lineNumber: "#8c959f", activeLine: "#f6f8fa", success: "#1a7f37", warning: "#9a6700" },
  },
  "one-light": {
    background: "#fafafa",
    foreground: "#383a42",
    accent: "#526fff",
    // Atom's #e5e5e6 is too faint to see; a little of its blue keeps the look.
    selection: "#d5dcf2",
    ansi: [
      "#383a42", "#e45649", "#50a14f", "#c18401", "#4078f2", "#a626a4", "#0184bc", "#a0a1a7",
      "#4f525e", "#e06c75", "#98c379", "#e5c07b", "#61afef", "#c678dd", "#56b6c2", "#ffffff",
    ],
    syntax: {
      keyword: "#a626a4", string: "#50a14f", number: "#986801", comment: "#a0a1a7", type: "#c18401",
      function: "#4078f2", property: "#e45649", meta: "#0184bc", tag: "#e45649", attr: "#986801", invalid: "#ca1243",
    },
    ui: { bg: "#eaeaeb", panelAlt: "#f0f0f1", lineNumber: "#9d9d9f", activeLine: "#f2f2f2" },
  },
  "solarized-light": {
    background: "#fdf6e3",
    // Between base01 and base02: base00 is below 4.5:1 on base3, and selected text needs more.
    foreground: "#4a5f66",
    accent: "#268bd2",
    selection: "#e0d9c3",
    ansi: [
      "#073642", "#dc322f", "#859900", "#b58900", "#268bd2", "#d33682", "#2aa198", "#eee8d5",
      "#002b36", "#cb4b16", "#586e75", "#657b83", "#839496", "#6c71c4", "#93a1a1", "#fdf6e3",
    ],
    syntax: {
      keyword: "#859900", string: "#2aa198", number: "#d33682", comment: "#93a1a1", type: "#b58900",
      function: "#268bd2", property: "#268bd2", meta: "#cb4b16", tag: "#268bd2", attr: "#93a1a1", invalid: "#dc322f",
    },
    ui: { bg: "#eee8d5", panel: "#fdf6e3", panelAlt: "#f5efdc", lineNumber: "#93a1a1", activeLine: "#eee8d5" },
  },
  "quiet-light": {
    background: "#f5f5f5",
    foreground: "#333333",
    accent: "#705697",
    selection: "#c9d0d9",
    ansi: VSCODE_ANSI_LIGHT,
    syntax: {
      keyword: "#4b69c6", string: "#448c27", number: "#ab6526", comment: "#aaaaaa", type: "#7a3e9d",
      function: "#aa3731", property: "#7a3e9d", meta: "#b2a900", tag: "#4b69c6", attr: "#8190a0", invalid: "#660000",
    },
    ui: { bg: "#ededf5", panel: "#f5f5f5", panelAlt: "#f2f2f2", lineNumber: "#6d705b", activeLine: "#e4f6d4" },
  },
  "ayu-light": {
    background: "#fcfcfc",
    foreground: "#5c6166",
    accent: "#ff9940",
    // A little stronger than ayu's 0.15 so the selection is clearly visible.
    selection: "rgba(3, 91, 214, 0.18)",
    ansi: [
      "#000000", "#ea6c6d", "#6cbf43", "#eca944", "#3199e1", "#9e75c7", "#46ba94", "#bababa",
      "#686868", "#f07171", "#86b300", "#f2ae49", "#399ee6", "#a37acc", "#4cbf99", "#d1d1d1",
    ],
    syntax: {
      keyword: "#fa8d3e", string: "#86b300", number: "#a37acc", comment: "#adaeb1", type: "#399ee6",
      function: "#f2ae49", property: "#f07171", meta: "#e6ba7e", tag: "#55b4d4", attr: "#f2ae49", invalid: "#e65050",
    },
    ui: { bg: "#f8f9fa", panel: "#fcfcfc", panelAlt: "#f3f4f5", lineNumber: "#a8adb3", activeLine: "#f0f1f2" },
  },
  "catppuccin-latte": {
    background: "#eff1f5",
    foreground: "#4c4f69",
    accent: "#8839ef",
    selection: "rgba(124, 127, 147, 0.3)",
    ansi: [
      "#5c5f77", "#d20f39", "#40a02b", "#df8e1d", "#1e66f5", "#ea76cb", "#179299", "#acb0be",
      "#6c6f85", "#d20f39", "#40a02b", "#df8e1d", "#1e66f5", "#ea76cb", "#179299", "#bcc0cc",
    ],
    syntax: {
      keyword: "#8839ef", string: "#40a02b", number: "#fe640b", comment: "#7c7f93", type: "#df8e1d",
      function: "#1e66f5", property: "#7287fd", meta: "#fe640b", tag: "#1e66f5", attr: "#df8e1d", invalid: "#d20f39",
    },
    ui: { bg: "#dce0e8", panel: "#eff1f5", panelAlt: "#e6e9ef", border: "#dce0e8", borderStrong: "#ccd0da", lineNumber: "#8c8fa1", activeLine: "#e6e9ef" },
  },
  "gruvbox-light": {
    background: "#fbf1c7",
    foreground: "#3c3836",
    accent: "#076678",
    selection: "#d5c4a1",
    ansi: [
      "#fbf1c7", "#cc241d", "#98971a", "#d79921", "#458588", "#b16286", "#689d6a", "#7c6f64",
      "#928374", "#9d0006", "#79740e", "#b57614", "#076678", "#8f3f71", "#427b58", "#3c3836",
    ],
    syntax: {
      keyword: "#9d0006", string: "#79740e", number: "#8f3f71", comment: "#928374", type: "#b57614",
      function: "#427b58", property: "#076678", meta: "#af3a03", tag: "#076678", attr: "#79740e", invalid: "#9d0006",
    },
    ui: { bg: "#ebdbb2", panel: "#fbf1c7", panelAlt: "#f2e5bc", border: "#ebdbb2", borderStrong: "#d5c4a1", lineNumber: "#a89984", activeLine: "#f2e5bc", success: "#79740e", danger: "#9d0006", warning: "#b57614" },
  },
  "tokyo-night-day": {
    background: "#e1e2e7",
    // Darker than #3760bf, and a deeper selection, so selected text stays readable.
    foreground: "#2b4ca0",
    accent: "#2e7de9",
    selection: "#c0c5d9",
    ansi: [
      "#e9e9ed", "#f52a65", "#587539", "#8c6c3e", "#2e7de9", "#9854f1", "#007197", "#6172b0",
      "#a1a6c5", "#f52a65", "#587539", "#8c6c3e", "#2e7de9", "#9854f1", "#007197", "#3760bf",
    ],
    syntax: {
      keyword: "#9854f1", string: "#587539", number: "#b15c00", comment: "#848cb5", type: "#188092",
      function: "#2e7de9", property: "#118c74", meta: "#006a83", tag: "#f52a65", attr: "#8c6c3e", invalid: "#c64343",
    },
    ui: { bg: "#d0d5e3", panel: "#e1e2e7", panelAlt: "#d6d8df", border: "#c4c8da", borderStrong: "#b4b8cc", lineNumber: "#848cb5", activeLine: "#d6d8df", danger: "#c64343" },
  },
  "rose-pine-dawn": {
    background: "#faf4ed",
    foreground: "#575279",
    accent: "#907aa9",
    selection: "#d8d3d4",
    ansi: [
      "#f2e9e1", "#b4637a", "#286983", "#ea9d34", "#56949f", "#907aa9", "#d7827e", "#575279",
      "#9893a5", "#b4637a", "#286983", "#ea9d34", "#56949f", "#907aa9", "#d7827e", "#575279",
    ],
    syntax: {
      keyword: "#286983", string: "#ea9d34", number: "#d7827e", comment: "#9893a5", type: "#56949f",
      function: "#d7827e", property: "#907aa9", meta: "#797593", tag: "#56949f", attr: "#907aa9", invalid: "#b4637a",
    },
    ui: { bg: "#f2e9e1", panel: "#fffaf3", panelAlt: "#f4ede8", border: "#f2e9e1", borderStrong: "#dfdad9", lineNumber: "#9893a5", activeLine: "#f4ede8", success: "#286983", info: "#907aa9" },
  },
  "intellij-light": {
    background: "#ffffff",
    foreground: "#080808",
    accent: "#2675bf",
    selection: "#a6d2ff",
    ansi: JETBRAINS_ANSI_LIGHT,
    syntax: {
      keyword: "#0033b3", string: "#067d17", number: "#1750eb", comment: "#8c8c8c", type: "#000000",
      function: "#00627a", property: "#871094", meta: "#9e880d", tag: "#0033b3", attr: "#174ad4", invalid: "#f50000",
    },
    ui: { bg: "#f2f2f2", panel: "#f2f2f2", panelAlt: "#e8e8e8", border: "#d1d1d1", borderStrong: "#c4c4c4", lineNumber: "#adadad", activeLine: "#fcfaed", success: "#067d17" },
  },
  // JetBrains Islands (IDEA 2025.3): white islands on a grey window. Colors from
  // ManyIslandsLight.theme.json and its "Light" editor scheme in intellij-community.
  "islands-light": {
    background: "#ffffff",
    foreground: "#000000",
    accent: "#3871e1",
    selection: "#a6d2ff",
    ansi: JETBRAINS_ANSI_LIGHT,
    syntax: {
      keyword: "#0033b3", string: "#067d17", number: "#1750eb", comment: "#8c8c8c", type: "#000000",
      function: "#00627a", property: "#871094", meta: "#9e880d", tag: "#0033b3", attr: "#174ad4", invalid: "#f50000",
    },
    ui: { bg: "#e9eaee", panel: "#ffffff", panelAlt: "#f7f8f9", border: "#e9eaee", borderStrong: "#dddfe4", lineNumber: "#aeb3c2", activeLine: "#f5f8fe", success: "#338555", danger: "#c54e58", warning: "#a56906", info: "#2f5eb9" },
  },
  // VS Code's Default Light+ and Dark+: tokens from extensions/theme-defaults in
  // microsoft/vscode, UI colors from its workbench defaults. Meta is the pink of
  // keyword.control, which Light+ and Dark+ give preprocessor directives.
  "vscode-light-plus": {
    background: "#ffffff",
    foreground: "#000000",
    accent: "#007acc",
    selection: "#add6ff",
    ansi: VSCODE_ANSI_LIGHT,
    syntax: {
      keyword: "#0000ff", string: "#a31515", number: "#098658", comment: "#008000", type: "#267f99",
      function: "#795e26", property: "#001080", meta: "#af00db", tag: "#800000", attr: "#e50000", invalid: "#cd3131",
    },
    ui: { bg: "#dddddd", panel: "#f3f3f3", panelAlt: "#ececec", border: "#e7e7e7", lineNumber: "#237893", activeLine: "#eeeeee", success: "#587c0c", danger: "#e51400", warning: "#bf8803", info: "#2090d3" },
  },

  darcula: {
    background: "#2b2b2b",
    foreground: "#a9b7c6",
    accent: "#4a88c7",
    selection: "#214283",
    ansi: DARCULA_ANSI,
    syntax: {
      keyword: "#cc7832", string: "#6a8759", number: "#6897bb", comment: "#808080", type: "#a9b7c6",
      function: "#ffc66d", property: "#9876aa", meta: "#bbb529", tag: "#e8bf6a", attr: "#bababa", invalid: "#bc3f3c",
    },
    ui: { bg: "#2b2b2b", panel: "#3c3f41", panelAlt: "#313335", border: "#323232", borderStrong: "#515151", lineNumber: "#606366", activeLine: "#323232", cursor: "#bbbbbb" },
  },
  // Dark islands on a lighter grey window. Colors from ManyIslandsDark.theme.json
  // and IslandSchemeDark.xml in intellij-community; selection and console colors
  // are inherited from Darcula.
  "islands-dark": {
    background: "#191a1c",
    foreground: "#d1d3d9",
    accent: "#3871e1",
    selection: "#214283",
    ansi: DARCULA_ANSI,
    syntax: {
      keyword: "#cf8e6d", string: "#6aab73", number: "#2aacb8", comment: "#7a7e85", type: "#bcbec4",
      function: "#56a8f5", property: "#c77dbb", meta: "#b3ae60", tag: "#d5b778", attr: "#bababa", invalid: "#f75464",
    },
    ui: { bg: "#26282c", panel: "#191a1c", panelAlt: "#212326", border: "#26282c", borderStrong: "#33353b", lineNumber: "#4b5059", activeLine: "#1f2024", cursor: "#ced0d6", success: "#6db083", danger: "#f57e84", warning: "#d59637", info: "#71a1fe" },
  },
  "vscode-dark-plus": {
    background: "#1e1e1e",
    foreground: "#d4d4d4",
    accent: "#007acc",
    selection: "#264f78",
    ansi: VSCODE_ANSI_DARK,
    syntax: {
      keyword: "#569cd6", string: "#ce9178", number: "#b5cea8", comment: "#6a9955", type: "#4ec9b0",
      function: "#dcdcaa", property: "#9cdcfe", meta: "#c586c0", tag: "#569cd6", attr: "#9cdcfe", invalid: "#f44747",
    },
    ui: { bg: "#3c3c3c", panel: "#252526", panelAlt: "#2d2d2d", border: "#1e1e1e", borderStrong: "#444444", lineNumber: "#858585", activeLine: "#282828", cursor: "#aeafad", success: "#81b88b", danger: "#f14c4c", warning: "#cca700", info: "#1b81a8" },
  },
  "one-dark-pro": {
    background: "#282c34",
    foreground: "#abb2bf",
    accent: "#4d78cc",
    selection: "#3e4451",
    ansi: [
      "#3f4451", "#e05561", "#8cc265", "#d18f52", "#4aa5f0", "#c162de", "#42b3c2", "#d7dae0",
      "#4f5666", "#ff616e", "#a5e075", "#f0a45d", "#4dc4ff", "#de73ff", "#4cd1e0", "#e6e6e6",
    ],
    syntax: {
      keyword: "#c678dd", string: "#98c379", number: "#d19a66", comment: "#7f848e", type: "#e5c07b",
      function: "#61afef", property: "#e06c75", meta: "#56b6c2", tag: "#e06c75", attr: "#d19a66", invalid: "#f44747",
    },
    ui: { bg: "#21252b", panel: "#21252b", panelAlt: "#252931", border: "#181a1f", borderStrong: "#3e4452", lineNumber: "#495162", activeLine: "#2c313c", cursor: "#528bff" },
  },
  dracula: {
    background: "#282a36",
    foreground: "#f8f8f2",
    accent: "#bd93f9",
    selection: "#44475a",
    ansi: [
      "#21222c", "#ff5555", "#50fa7b", "#f1fa8c", "#bd93f9", "#ff79c6", "#8be9fd", "#f8f8f2",
      "#6272a4", "#ff6e6e", "#69ff94", "#ffffa5", "#d6acff", "#ff92df", "#a4ffff", "#ffffff",
    ],
    syntax: {
      keyword: "#ff79c6", string: "#f1fa8c", number: "#bd93f9", comment: "#6272a4", type: "#8be9fd",
      function: "#50fa7b", property: "#66d9ef", meta: "#ffb86c", tag: "#ff79c6", attr: "#50fa7b", invalid: "#ff5555",
    },
    ui: { bg: "#21222c", panel: "#21222c", panelAlt: "#242530", border: "#191a21", borderStrong: "#44475a", lineNumber: "#6272a4", activeLine: "#2f3141", info: "#8be9fd" },
  },
  monokai: {
    background: "#272822",
    foreground: "#f8f8f2",
    accent: "#66d9ef",
    selection: "#49483e",
    ansi: [
      "#333333", "#c4265e", "#86b42b", "#b3b42b", "#6a7ec8", "#8c6bc8", "#56adbc", "#e3e3dd",
      "#666666", "#f92672", "#a6e22e", "#e2e22e", "#819aff", "#ae81ff", "#66d9ef", "#f8f8f2",
    ],
    syntax: {
      keyword: "#f92672", string: "#e6db74", number: "#ae81ff", comment: "#75715e", type: "#66d9ef",
      function: "#a6e22e", property: "#fd971f", meta: "#e6db74", tag: "#f92672", attr: "#a6e22e", invalid: "#f44747",
    },
    ui: { bg: "#1e1f1c", panel: "#1e1f1c", panelAlt: "#22231f", border: "#171814", borderStrong: "#414339", lineNumber: "#90908a", activeLine: "#3e3d32", cursor: "#f8f8f0" },
  },
  "monokai-pro": {
    background: "#2d2a2e",
    foreground: "#fcfcfa",
    accent: "#ffd866",
    selection: "#4a474c",
    ansi: [
      "#403e41", "#ff6188", "#a9dc76", "#ffd866", "#fc9867", "#ab9df2", "#78dce8", "#fcfcfa",
      "#727072", "#ff6188", "#a9dc76", "#ffd866", "#fc9867", "#ab9df2", "#78dce8", "#fcfcfa",
    ],
    syntax: {
      keyword: "#ff6188", string: "#ffd866", number: "#ab9df2", comment: "#727072", type: "#78dce8",
      function: "#a9dc76", property: "#fc9867", meta: "#ab9df2", tag: "#ff6188", attr: "#78dce8", invalid: "#ff6188",
    },
    ui: { bg: "#221f22", panel: "#221f22", panelAlt: "#272427", border: "#19181a", borderStrong: "#403e41", lineNumber: "#5b595c", activeLine: "#363337", info: "#78dce8" },
  },
  nord: {
    background: "#2e3440",
    foreground: "#d8dee9",
    accent: "#88c0d0",
    selection: "#434c5e",
    ansi: [
      "#3b4252", "#bf616a", "#a3be8c", "#ebcb8b", "#81a1c1", "#b48ead", "#88c0d0", "#e5e9f0",
      "#4c566a", "#bf616a", "#a3be8c", "#ebcb8b", "#81a1c1", "#b48ead", "#8fbcbb", "#eceff4",
    ],
    syntax: {
      keyword: "#81a1c1", string: "#a3be8c", number: "#b48ead", comment: "#616e88", type: "#8fbcbb",
      function: "#88c0d0", property: "#8fbcbb", meta: "#d08770", tag: "#81a1c1", attr: "#8fbcbb", invalid: "#bf616a",
    },
    ui: { bg: "#2e3440", panel: "#3b4252", panelAlt: "#343a48", border: "#2a2f3a", borderStrong: "#4c566a", lineNumber: "#4c566a", activeLine: "#3b4252" },
  },
  "solarized-dark": {
    background: "#002b36",
    // base1 lifted a little: base0 is below 4.5:1 on base03 once text is selected.
    foreground: "#9fadad",
    accent: "#268bd2",
    selection: "#0d4251",
    ansi: [
      "#073642", "#dc322f", "#859900", "#b58900", "#268bd2", "#d33682", "#2aa198", "#eee8d5",
      "#002b36", "#cb4b16", "#586e75", "#657b83", "#839496", "#6c71c4", "#93a1a1", "#fdf6e3",
    ],
    syntax: {
      keyword: "#859900", string: "#2aa198", number: "#d33682", comment: "#586e75", type: "#b58900",
      function: "#268bd2", property: "#268bd2", meta: "#cb4b16", tag: "#268bd2", attr: "#93a1a1", invalid: "#dc322f",
    },
    ui: { bg: "#00212b", panel: "#00212b", panelAlt: "#002630", border: "#001a22", borderStrong: "#0c4352", lineNumber: "#586e75", activeLine: "#073642", success: "#859900", danger: "#dc322f", warning: "#b58900", info: "#268bd2" },
  },
  "github-dark": {
    background: "#0d1117",
    foreground: "#e6edf3",
    accent: "#2f81f7",
    selection: "#264f78",
    ansi: [
      "#484f58", "#ff7b72", "#3fb950", "#d29922", "#58a6ff", "#bc8cff", "#39c5cf", "#b1bac4",
      "#6e7681", "#ffa198", "#56d364", "#e3b341", "#79c0ff", "#d2a8ff", "#56d4dd", "#ffffff",
    ],
    syntax: {
      keyword: "#ff7b72", string: "#a5d6ff", number: "#79c0ff", comment: "#8b949e", type: "#ffa657",
      function: "#d2a8ff", property: "#79c0ff", meta: "#ffa657", tag: "#7ee787", attr: "#79c0ff", invalid: "#ffa198",
    },
    ui: { bg: "#010409", panel: "#161b22", panelAlt: "#0d1117", border: "#21262d", borderStrong: "#30363d", lineNumber: "#6e7681", activeLine: "#161b22" },
  },
  "github-dark-dimmed": {
    background: "#22272e",
    foreground: "#adbac7",
    accent: "#539bf5",
    selection: "#2e4560",
    ansi: [
      "#545d68", "#f47067", "#57ab5a", "#c69026", "#539bf5", "#b083f0", "#39c5cf", "#909dab",
      "#636e7b", "#ff938a", "#6bc46d", "#daaa3f", "#6cb6ff", "#dcbdfb", "#56d4dd", "#cdd9e5",
    ],
    syntax: {
      keyword: "#f47067", string: "#96d0ff", number: "#6cb6ff", comment: "#768390", type: "#f69d50",
      function: "#dcbdfb", property: "#6cb6ff", meta: "#f69d50", tag: "#8ddb8c", attr: "#6cb6ff", invalid: "#ff938a",
    },
    ui: { bg: "#1c2128", panel: "#2d333b", panelAlt: "#262c34", border: "#1c2128", borderStrong: "#444c56", lineNumber: "#636e7b", activeLine: "#2d333b" },
  },
  "gruvbox-dark": {
    background: "#282828",
    foreground: "#ebdbb2",
    accent: "#fe8019",
    selection: "#504945",
    ansi: [
      "#282828", "#cc241d", "#98971a", "#d79921", "#458588", "#b16286", "#689d6a", "#a89984",
      "#928374", "#fb4934", "#b8bb26", "#fabd2f", "#83a598", "#d3869b", "#8ec07c", "#ebdbb2",
    ],
    syntax: {
      keyword: "#fb4934", string: "#b8bb26", number: "#d3869b", comment: "#928374", type: "#fabd2f",
      function: "#8ec07c", property: "#83a598", meta: "#fe8019", tag: "#83a598", attr: "#fabd2f", invalid: "#fb4934",
    },
    ui: { bg: "#1d2021", panel: "#32302f", panelAlt: "#2c2a29", border: "#1d2021", borderStrong: "#504945", lineNumber: "#7c6f64", activeLine: "#3c3836" },
  },
  "tokyo-night": {
    background: "#1a1b26",
    foreground: "#a9b1d6",
    accent: "#7aa2f7",
    selection: "#283457",
    ansi: [
      "#15161e", "#f7768e", "#9ece6a", "#e0af68", "#7aa2f7", "#bb9af7", "#7dcfff", "#a9b1d6",
      "#414868", "#f7768e", "#9ece6a", "#e0af68", "#7aa2f7", "#bb9af7", "#7dcfff", "#c0caf5",
    ],
    syntax: {
      keyword: "#bb9af7", string: "#9ece6a", number: "#ff9e64", comment: "#565f89", type: "#2ac3de",
      function: "#7aa2f7", property: "#73daca", meta: "#7dcfff", tag: "#f7768e", attr: "#bb9af7", invalid: "#db4b4b",
    },
    ui: { bg: "#16161e", panel: "#16161e", panelAlt: "#181922", border: "#101014", borderStrong: "#2a2b3d", lineNumber: "#3b4261", activeLine: "#1e202e", cursor: "#c0caf5" },
  },
  "catppuccin-mocha": {
    background: "#1e1e2e",
    foreground: "#cdd6f4",
    accent: "#cba6f7",
    selection: "rgba(147, 153, 178, 0.3)",
    ansi: [
      "#45475a", "#f38ba8", "#a6e3a1", "#f9e2af", "#89b4fa", "#f5c2e7", "#94e2d5", "#bac2de",
      "#585b70", "#f38ba8", "#a6e3a1", "#f9e2af", "#89b4fa", "#f5c2e7", "#94e2d5", "#a6adc8",
    ],
    syntax: {
      keyword: "#cba6f7", string: "#a6e3a1", number: "#fab387", comment: "#9399b2", type: "#f9e2af",
      function: "#89b4fa", property: "#b4befe", meta: "#fab387", tag: "#89b4fa", attr: "#f9e2af", invalid: "#f38ba8",
    },
    ui: { bg: "#11111b", panel: "#181825", panelAlt: "#1b1b29", border: "#11111b", borderStrong: "#313244", lineNumber: "#7f849c", activeLine: "#313244", cursor: "#f5e0dc" },
  },
  "catppuccin-macchiato": {
    background: "#24273a",
    foreground: "#cad3f5",
    accent: "#c6a0f6",
    selection: "rgba(147, 154, 183, 0.3)",
    ansi: [
      "#494d64", "#ed8796", "#a6da95", "#eed49f", "#8aadf4", "#f5bde6", "#8bd5ca", "#b8c0e0",
      "#5b6078", "#ed8796", "#a6da95", "#eed49f", "#8aadf4", "#f5bde6", "#8bd5ca", "#a5adcb",
    ],
    syntax: {
      keyword: "#c6a0f6", string: "#a6da95", number: "#f5a97f", comment: "#939ab7", type: "#eed49f",
      function: "#8aadf4", property: "#b7bdf8", meta: "#f5a97f", tag: "#8aadf4", attr: "#eed49f", invalid: "#ed8796",
    },
    ui: { bg: "#181926", panel: "#1e2030", panelAlt: "#212335", border: "#181926", borderStrong: "#363a4f", lineNumber: "#8087a2", activeLine: "#363a4f", cursor: "#f4dbd6" },
  },
  "ayu-dark": {
    background: "#0b0e14",
    foreground: "#bfbdb6",
    accent: "#e6b450",
    selection: "#273747",
    ansi: [
      "#01060e", "#ea6c73", "#7fd962", "#f9af4f", "#53bdfa", "#cda1fa", "#90e1c6", "#c7c7c7",
      "#686868", "#f07178", "#aad94c", "#ffb454", "#59c2ff", "#d2a6ff", "#95e6cb", "#ffffff",
    ],
    syntax: {
      keyword: "#ff8f40", string: "#aad94c", number: "#d2a6ff", comment: "#636a72", type: "#59c2ff",
      function: "#ffb454", property: "#f07178", meta: "#e6c08a", tag: "#39bae6", attr: "#ffb454", invalid: "#d95757",
    },
    ui: { bg: "#0d1017", panel: "#0d1017", panelAlt: "#0f131a", border: "#06080b", borderStrong: "#1b1f29", lineNumber: "#4a5059", activeLine: "#131721", cursor: "#e6b450" },
  },
  "ayu-mirage": {
    background: "#242936",
    foreground: "#cccac2",
    accent: "#ffcc66",
    selection: "#33415e",
    ansi: [
      "#171b24", "#ed8274", "#87d96c", "#facc6e", "#6dcbfa", "#dabafa", "#90e1c6", "#c7c7c7",
      "#686868", "#f28779", "#d5ff80", "#ffd173", "#73d0ff", "#dfbfff", "#95e6cb", "#ffffff",
    ],
    syntax: {
      keyword: "#ffad66", string: "#d5ff80", number: "#dfbfff", comment: "#6e7c8f", type: "#73d0ff",
      function: "#ffd173", property: "#f28779", meta: "#ffdfb3", tag: "#5ccfe6", attr: "#ffd173", invalid: "#ff6666",
    },
    ui: { bg: "#1f2430", panel: "#1f2430", panelAlt: "#222733", border: "#171b24", borderStrong: "#343a48", lineNumber: "#5a6070", activeLine: "#1a1f29", cursor: "#ffcc66" },
  },
  "material-palenight": {
    background: "#292d3e",
    // The older, lighter Palenight text: #a6accd fades too much on the selection.
    foreground: "#bfc7d5",
    accent: "#80cbc4",
    selection: "rgba(113, 124, 180, 0.31)",
    ansi: [
      "#676e95", "#ff5370", "#c3e88d", "#ffcb6b", "#82aaff", "#c792ea", "#89ddff", "#ffffff",
      "#676e95", "#ff5370", "#c3e88d", "#ffcb6b", "#82aaff", "#c792ea", "#89ddff", "#ffffff",
    ],
    syntax: {
      keyword: "#c792ea", string: "#c3e88d", number: "#f78c6c", comment: "#676e95", type: "#ffcb6b",
      function: "#82aaff", property: "#f07178", meta: "#89ddff", tag: "#f07178", attr: "#c792ea", invalid: "#ff5370",
    },
    ui: { bg: "#292d3e", panel: "#292d3e", panelAlt: "#2b2f41", border: "#202331", borderStrong: "#3a3f58", lineNumber: "#4e5579", activeLine: "#2f3347", cursor: "#ffcc00" },
  },
  "night-owl": {
    background: "#011627",
    foreground: "#d6deeb",
    accent: "#7e57c2",
    selection: "#1d3b53",
    ansi: [
      "#011627", "#ef5350", "#22da6e", "#c5e478", "#82aaff", "#c792ea", "#21c7a8", "#ffffff",
      "#575656", "#ef5350", "#22da6e", "#ffeb95", "#82aaff", "#c792ea", "#7fdbca", "#ffffff",
    ],
    syntax: {
      keyword: "#c792ea", string: "#ecc48d", number: "#f78c6c", comment: "#637777", type: "#ffcb8b",
      function: "#82aaff", property: "#7fdbca", meta: "#7fdbca", tag: "#caece6", attr: "#addb67", invalid: "#ef5350",
    },
    ui: { bg: "#011627", panel: "#011627", panelAlt: "#021a2d", border: "#010e1a", borderStrong: "#122d42", lineNumber: "#4b6479", activeLine: "#01121f", cursor: "#80a4c2", warning: "#ffcb8b" },
  },
  cobalt2: {
    background: "#193549",
    foreground: "#ffffff",
    accent: "#ffc600",
    selection: "#0050a4",
    ansi: [
      "#000000", "#ff0000", "#38de21", "#ffe50a", "#1460d2", "#ff005d", "#00bbbb", "#bbbbbb",
      "#555555", "#f40e17", "#3bd01d", "#edc809", "#5555ff", "#ff55ff", "#6ae3fa", "#ffffff",
    ],
    syntax: {
      keyword: "#ff9d00", string: "#3ad900", number: "#ff628c", comment: "#0088ff", type: "#80ffbb",
      function: "#ffc600", property: "#9effff", meta: "#ff9d00", tag: "#9effff", attr: "#ffc600", invalid: "#ff2c70",
    },
    ui: { bg: "#15232d", panel: "#15232d", panelAlt: "#172b3a", border: "#0d3a58", borderStrong: "#1f4662", lineNumber: "#aaaaaa", activeLine: "#1f4662", cursor: "#ffc600", info: "#0088ff" },
  },
  "rose-pine": {
    background: "#191724",
    foreground: "#e0def4",
    accent: "#c4a7e7",
    selection: "#403d52",
    ansi: [
      "#26233a", "#eb6f92", "#31748f", "#f6c177", "#9ccfd8", "#c4a7e7", "#ebbcba", "#e0def4",
      "#6e6a86", "#eb6f92", "#31748f", "#f6c177", "#9ccfd8", "#c4a7e7", "#ebbcba", "#e0def4",
    ],
    syntax: {
      keyword: "#31748f", string: "#f6c177", number: "#ebbcba", comment: "#6e6a86", type: "#9ccfd8",
      function: "#ebbcba", property: "#c4a7e7", meta: "#908caa", tag: "#9ccfd8", attr: "#c4a7e7", invalid: "#eb6f92",
    },
    ui: { bg: "#191724", panel: "#1f1d2e", panelAlt: "#1c1a29", border: "#141220", borderStrong: "#26233a", lineNumber: "#6e6a86", activeLine: "#21202e", success: "#9ccfd8", info: "#c4a7e7" },
  },
  kanagawa: {
    background: "#1f1f28",
    foreground: "#dcd7ba",
    accent: "#7e9cd8",
    // waveBlue2: waveBlue1 (#223249) is too close to sumiInk3 to see.
    selection: "#2d4f67",
    ansi: [
      "#090618", "#c34043", "#76946a", "#c0a36e", "#7e9cd8", "#957fb8", "#6a9589", "#c8c093",
      "#727169", "#e82424", "#98bb6c", "#e6c384", "#7fb4ca", "#938aa9", "#7aa89f", "#dcd7ba",
    ],
    syntax: {
      keyword: "#957fb8", string: "#98bb6c", number: "#d27e99", comment: "#727169", type: "#7aa89f",
      function: "#7e9cd8", property: "#e6c384", meta: "#e46876", tag: "#e46876", attr: "#e6c384", invalid: "#e82424",
    },
    ui: { bg: "#16161d", panel: "#16161d", panelAlt: "#1a1a22", border: "#121218", borderStrong: "#363646", lineNumber: "#54546d", activeLine: "#2a2a37", cursor: "#c8c093" },
  },

  "high-contrast-dark": {
    background: "#000000",
    foreground: "#ffffff",
    accent: "#f38518",
    selection: "#264f78",
    ansi: [
      "#000000", "#cd0000", "#00cd00", "#cdcd00", "#0000ee", "#cd00cd", "#00cdcd", "#e5e5e5",
      "#7f7f7f", "#ff0000", "#00ff00", "#ffff00", "#5c5cff", "#ff00ff", "#00ffff", "#ffffff",
    ],
    syntax: {
      keyword: "#569cd6", string: "#ce9178", number: "#b5cea8", comment: "#7ca668", type: "#4ec9b0",
      function: "#dcdcaa", property: "#9cdcfe", meta: "#d7ba7d", tag: "#569cd6", attr: "#9cdcfe", invalid: "#f44747",
    },
    ui: { bg: "#000000", panel: "#000000", panelAlt: "#000000", border: "#6fc3df", borderStrong: "#6fc3df", lineNumber: "#ffffff", activeLine: "#1a1a1a", info: "#3794ff", success: "#89d185", danger: "#f48771", warning: "#cca700" },
  },
  "github-dark-high-contrast": {
    background: "#0a0c10",
    foreground: "#f0f3f6",
    accent: "#409eff",
    selection: "#1e4273",
    ansi: [
      "#7a828e", "#ff9492", "#26cd4d", "#f0b72f", "#71b7ff", "#cb9eff", "#39c5cf", "#d9dee3",
      "#9ea7b3", "#ffb1af", "#4ae168", "#f7c843", "#91cbff", "#dbb7ff", "#56d4dd", "#ffffff",
    ],
    syntax: {
      keyword: "#ff9492", string: "#addcff", number: "#91cbff", comment: "#bdc4cc", type: "#ffb757",
      function: "#dbb7ff", property: "#91cbff", meta: "#ffb757", tag: "#72f088", attr: "#91cbff", invalid: "#ffb1af",
    },
    ui: { bg: "#010409", panel: "#010409", panelAlt: "#0a0c10", border: "#7a828e", borderStrong: "#7a828e", lineNumber: "#9ea7b3", activeLine: "#151a21", info: "#409eff" },
  },
  "amber-high-contrast": {
    background: "#000000",
    foreground: "#ffb000",
    accent: "#ffcc00",
    selection: "#5c3d00",
    ansi: [
      "#000000", "#ff6a3d", "#d4e157", "#ffcc00", "#ffd27a", "#ffa94d", "#ffe0a3", "#ffb000",
      "#8a6000", "#ff8a65", "#e6ee9c", "#ffe066", "#ffe0a3", "#ffc077", "#fff0cc", "#ffd27a",
    ],
    syntax: {
      keyword: "#ffd257", string: "#ffe0a3", number: "#ffcf70", comment: "#c98a00", type: "#ffc94d",
      function: "#fff0cc", property: "#ffbe3d", meta: "#e6a200", tag: "#ffd257", attr: "#ffbe3d", invalid: "#ff6a3d",
    },
    ui: { bg: "#000000", panel: "#0a0700", panelAlt: "#050300", border: "#b37b00", borderStrong: "#b37b00", lineNumber: "#c98a00", activeLine: "#1f1500", info: "#ffd27a", success: "#d4e157", danger: "#ff6a3d", warning: "#ffe066" },
  },
  "high-contrast-light": {
    background: "#ffffff",
    foreground: "#292929",
    accent: "#0f4a85",
    selection: "#c8dcf0",
    ansi: [
      "#292929", "#b5200d", "#136c13", "#6c5b00", "#0f4a85", "#8b008b", "#0f6e7a", "#555555",
      "#444444", "#a1260d", "#0e5a0e", "#5a4b00", "#0451a5", "#7a0f85", "#0f5d66", "#222222",
    ],
    syntax: {
      keyword: "#0f4a85", string: "#a31515", number: "#096d48", comment: "#515151", type: "#185e73",
      function: "#5e2cbc", property: "#001080", meta: "#795e26", tag: "#0f4a85", attr: "#264f78", invalid: "#b5200d",
    },
    ui: { bg: "#ffffff", panel: "#ffffff", panelAlt: "#ffffff", border: "#0f4a85", borderStrong: "#0f4a85", lineNumber: "#292929", activeLine: "#eef3f8", danger: "#b5200d", success: "#136c13", warning: "#895503" },
  },
  "github-light-high-contrast": {
    background: "#ffffff",
    foreground: "#0e1116",
    accent: "#0349b4",
    selection: "#c6d8f4",
    ansi: [
      "#0e1116", "#a0111f", "#024c1a", "#3f2200", "#0349b4", "#622cbc", "#1b7c83", "#66707b",
      "#4b535d", "#86061d", "#055d20", "#4e2c00", "#1168e3", "#844ae7", "#3192aa", "#88929d",
    ],
    syntax: {
      keyword: "#a0111f", string: "#032563", number: "#023b95", comment: "#4b535d", type: "#702c00",
      function: "#622cbc", property: "#023b95", meta: "#702c00", tag: "#024c1a", attr: "#023b95", invalid: "#6e011a",
    },
    ui: { bg: "#ffffff", panel: "#ffffff", panelAlt: "#e7ecf0", border: "#20252c", borderStrong: "#20252c", lineNumber: "#4b535d", activeLine: "#f0f3f6", success: "#055d20", warning: "#744500" },
  },
};

function deriveColors(kind: ThemeKind, spec: ThemeSpec): ThemeColors {
  const dark = modeOfKind(kind) === "dark";
  const high = isHighContrast(kind);
  const ui = spec.ui ?? {};
  const [, red, green, yellow, blue, magenta, , , , brightRed, brightGreen, brightYellow, brightBlue, brightMagenta] = spec.ansi;
  const editorBg = spec.background;
  const text = spec.foreground;
  const panel = ui.panel ?? (dark ? mix(editorBg, text, 0.05) : editorBg);
  const panelAlt = ui.panelAlt ?? (dark ? mix(editorBg, text, 0.025) : mix(editorBg, text, 0.035));
  const bg = ui.bg ?? (dark ? editorBg : mix(editorBg, text, 0.025));
  const textMinimum = high ? 7 : 4.5;
  // Hints and status colors must read on every surface they sit on.
  const legible = (color: string, minimum: number) => ensureContrast(ensureContrast(color, panel, minimum), bg, minimum);
  const accent = legible(spec.accent, high ? 4.5 : 3);
  const accentText = ["#ffffff", dark ? editorBg : "#000000"].reduce((best, candidate) =>
    contrastRatio(candidate, accent) > contrastRatio(best, accent) ? candidate : best,
  );
  const success = legible(ui.success ?? (dark ? brightGreen : green), high ? 4.5 : 3);
  const danger = legible(ui.danger ?? (dark ? brightRed : red), high ? 4.5 : 3);
  const warning = legible(ui.warning ?? (dark ? brightYellow : yellow), high ? 4.5 : 3);
  const info = ui.info ?? (dark ? brightBlue : blue);
  const textDim = legible(mix(text, panel, 0.35), textMinimum);
  const selection = composite(spec.selection, editorBg);
  const grey = mix(text, editorBg, 0.5);
  // High contrast themes get stronger diff tints so changed lines stand out.
  const tint = (dark ? 1 : 0.8) * (high ? 1.6 : 1);
  const diffTint = (color: string, alpha: number) => fitTint(color, editorBg, text, alpha * tint, 4.5);
  const syntax = (color: string) => (high ? ensureContrast(color, editorBg, 7) : color);
  const bracket = (color: string) => ensureContrast(color, editorBg, high ? 7 : 3);
  return {
    "--bg": bg,
    "--panel": panel,
    "--panel-alt": panelAlt,
    "--border": ui.border ?? (dark ? mix(panel, "#000000", 0.3) : mix(panel, text, 0.07)),
    "--border-strong": ui.borderStrong ?? mix(panel, text, dark ? 0.1 : 0.13),
    "--text": text,
    "--text-dim": textDim,
    "--text-faint": legible(mix(text, panel, 0.6), high ? 4.5 : 2),
    "--accent": accent,
    "--accent-hover": mix(accent, dark ? "#ffffff" : "#000000", 0.12),
    "--accent-text": accentText,
    "--hover": mix(panel, text, high ? 0.16 : dark ? 0.08 : 0.06),
    "--selected": composite(fitTint(accent, panel, text, dark ? 0.3 : 0.18, textMinimum), panel),
    "--selected-inactive": mix(panel, text, dark ? 0.1 : 0.09),
    "--danger": danger,
    "--success": success,
    "--warning": warning,
    "--shadow": dark ? SHADOW_DARK : SHADOW_LIGHT,
    "--overlay": dark ? "rgba(0, 0, 0, 0.45)" : "rgba(0, 0, 0, 0.28)",
    "--editor-bg": editorBg,
    "--editor-gutter": editorBg,
    "--editor-line-number": ensureContrast(ui.lineNumber ?? mix(text, editorBg, 0.6), editorBg, high ? 4.5 : 1.8),
    "--editor-active-line": ui.activeLine ?? mix(editorBg, text, dark ? 0.04 : 0.035),
    "--editor-selection": selection,
    "--editor-cursor": ui.cursor ?? text,
    "--term-background": editorBg,
    "--term-foreground": text,
    "--term-cursor": ui.cursor ?? text,
    "--term-selection": selection,
    "--term-black": spec.ansi[0],
    "--term-red": spec.ansi[1],
    "--term-green": spec.ansi[2],
    "--term-yellow": spec.ansi[3],
    "--term-blue": spec.ansi[4],
    "--term-magenta": spec.ansi[5],
    "--term-cyan": spec.ansi[6],
    "--term-white": spec.ansi[7],
    "--term-bright-black": spec.ansi[8],
    "--term-bright-red": spec.ansi[9],
    "--term-bright-green": spec.ansi[10],
    "--term-bright-yellow": spec.ansi[11],
    "--term-bright-blue": spec.ansi[12],
    "--term-bright-magenta": spec.ansi[13],
    "--term-bright-cyan": spec.ansi[14],
    "--term-bright-white": spec.ansi[15],
    "--term-scrollbar": withAlpha(textDim, 0.35),
    "--term-scrollbar-hover": withAlpha(textDim, 0.55),
    "--diff-modified": diffTint(info, 0.17),
    "--diff-modified-edge": info,
    "--diff-added": diffTint(success, 0.2),
    "--diff-added-edge": success,
    "--diff-deleted": diffTint(grey, 0.25),
    "--diff-deleted-edge": mix(text, editorBg, 0.45),
    "--diff-conflict": diffTint(danger, 0.2),
    "--diff-conflict-edge": danger,
    "--diff-inline": diffTint(info, 0.35),
    "--tok-keyword": syntax(spec.syntax.keyword),
    "--tok-string": syntax(spec.syntax.string),
    "--tok-number": syntax(spec.syntax.number),
    "--tok-comment": syntax(spec.syntax.comment),
    "--tok-type": syntax(spec.syntax.type),
    "--tok-function": syntax(spec.syntax.function),
    "--tok-property": syntax(spec.syntax.property),
    "--tok-meta": syntax(spec.syntax.meta ?? spec.syntax.number),
    "--tok-tag": syntax(spec.syntax.tag ?? spec.syntax.keyword),
    "--tok-attr": syntax(spec.syntax.attr ?? spec.syntax.property),
    "--tok-invalid": syntax(spec.syntax.invalid ?? danger),
    // Bracket depth colors from the terminal palette, like VS Code's gold, orchid and blue.
    "--bracket-1": bracket(dark ? brightYellow : blue),
    "--bracket-2": bracket(dark ? brightMagenta : green),
    "--bracket-3": bracket(dark ? brightBlue : magenta),
  };
}

/** Every token's value for a theme; null for an unknown id. Computed each call, nothing is kept. */
export function themeColors(themeId: string): ThemeColors | null {
  if (themeId === DEFAULT_LIGHT_THEME) {
    return { ...GM_LIGHT };
  }
  if (themeId === DEFAULT_DARK_THEME) {
    return { ...GM_DARK };
  }
  const info = themeInfo(themeId);
  const spec = SPECS[themeId];
  return info && spec ? deriveColors(info.kind, spec) : null;
}

/** Ids with a palette, in THEME_INDEX order (the tests check every listed theme has one). */
export function catalogThemeIds(): string[] {
  return THEME_INDEX.map((theme) => theme.id).filter((themeId) => themeId === DEFAULT_LIGHT_THEME || themeId === DEFAULT_DARK_THEME || themeId in SPECS);
}

/**
 * The CSS rule for a theme, scoped to data-color-theme so it can only apply
 * together with the attribute. `html:root` outranks app.css's `:root[data-theme]`.
 */
export function themeCss(themeId: string): string | null {
  const info = themeInfo(themeId);
  const colors = themeColors(themeId);
  if (!info || !colors) {
    return null;
  }
  const lines = COLOR_TOKENS.map((token) => `  ${token}: ${colors[token]};`);
  lines.push(`  color-scheme: ${modeOfKind(info.kind)};`);
  return `html:root[data-color-theme="${themeId}"] {\n${lines.join("\n")}\n}\n`;
}

/** The few colors a picker swatch shows. */
export interface ThemeSwatch {
  background: string;
  foreground: string;
  keyword: string;
  string: string;
  selection: string;
  accent: string;
  border: string;
}

export function themeSwatch(themeId: string): ThemeSwatch | null {
  const colors = themeColors(themeId);
  if (!colors) {
    return null;
  }
  return {
    background: colors["--editor-bg"],
    foreground: colors["--text"],
    keyword: colors["--tok-keyword"],
    string: colors["--tok-string"],
    selection: colors["--editor-selection"],
    accent: colors["--accent"],
    border: colors["--border-strong"],
  };
}
