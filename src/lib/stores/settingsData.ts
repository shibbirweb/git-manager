// Pure parts of the settings store: validating what ~/.gitmanager/settings.json
// and state.json hold, turning it back into JSON, deciding which files may be
// written and which session to restore on start. Kept free of Svelte and Tauri
// so it can be tested directly.

import { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME, pickThemeId } from "../themes/themeIndex";

export type ThemeSetting = "system" | "light" | "dark";

/** Which panel the left sidebar shows; null hides it. */
export type LeftPanel = "changes" | "branches" | "scripts" | null;

export type UpdateChannelSetting = "auto" | "stable" | "beta";

/** How Git > Update Project pulls each repository. */
export type UpdateMethod = "merge" | "rebase";

export const UPDATE_METHODS = ["merge", "rebase"] as const;

/** Commit Options' GPG signing: commit.gpgSign decides, -S, or --no-gpg-sign. */
export type CommitGpgSign = "default" | "sign" | "noSign";

export const COMMIT_GPG_SIGNS = ["default", "sign", "noSign"] as const;

/** Which spaces and tabs the editors draw as dots and arrows, like VS Code's editor.renderWhitespace. */
export type RenderWhitespace = "none" | "boundary" | "selection" | "trailing" | "all";

export const RENDER_WHITESPACE_CHOICES: { value: RenderWhitespace; label: string; hint: string }[] = [
  { value: "none", label: "None", hint: "Spaces and tabs are not drawn." },
  { value: "boundary", label: "Boundary", hint: "Draw all spaces and tabs except single spaces between words." },
  { value: "selection", label: "Selection", hint: "Draw spaces and tabs only inside selected text." },
  { value: "trailing", label: "Trailing", hint: "Draw only the spaces and tabs at the end of lines." },
  { value: "all", label: "All", hint: "Draw every space and tab." },
];

const RENDER_WHITESPACE_VALUES = RENDER_WHITESPACE_CHOICES.map((choice) => choice.value);

/** How the editors draw the cursor, like VS Code's editor.cursorStyle. */
export type EditorCursorStyle = "line" | "line-thin" | "block" | "block-outline" | "underline" | "underline-thin";

export const EDITOR_CURSOR_STYLE_CHOICES: { value: EditorCursorStyle; label: string }[] = [
  { value: "line", label: "Line" },
  { value: "line-thin", label: "Line thin" },
  { value: "block", label: "Block" },
  { value: "block-outline", label: "Block outline" },
  { value: "underline", label: "Underline" },
  { value: "underline-thin", label: "Underline thin" },
];

const EDITOR_CURSOR_STYLES = EDITOR_CURSOR_STYLE_CHOICES.map((choice) => choice.value);

/** How the editor cursor blinks, like VS Code's editor.cursorBlinking. */
export type EditorCursorBlinking = "blink" | "smooth" | "phase" | "expand" | "solid";

export const EDITOR_CURSOR_BLINKING_CHOICES: { value: EditorCursorBlinking; label: string; hint: string }[] = [
  { value: "blink", label: "Blink", hint: "On and off." },
  { value: "smooth", label: "Smooth", hint: "Fades out and in." },
  { value: "phase", label: "Phase", hint: "Fades slowly, staying visible longer." },
  { value: "expand", label: "Expand", hint: "Shrinks to its middle and grows back." },
  { value: "solid", label: "Solid", hint: "Never blinks." },
];

const EDITOR_CURSOR_BLINKINGS = EDITOR_CURSOR_BLINKING_CHOICES.map((choice) => choice.value);

export type ConfigName = "settings" | "state";

/** Weight of terminal text; mapped to xterm's fontWeight values in terminal/fonts.ts. */
export type TerminalFontWeight = "normal" | "medium" | "bold";

export type TerminalCursorStyle = "block" | "bar" | "underline";

/** How a Markdown file opens: source only, source beside its preview, or the preview only. */
export type MarkdownViewMode = "editor" | "split" | "preview";

export const MARKDOWN_VIEW_MODES = ["editor", "split", "preview"] as const;
/** Share of the editor area the Markdown preview takes in split mode. */
export const DEFAULT_MARKDOWN_PREVIEW_RATIO = 0.5;
export const MARKDOWN_PREVIEW_RATIO_RANGE = [0.15, 0.85] as const;

/** Sections of the Settings dialog, in the order the dialog lists them. */
export const SETTINGS_SECTIONS = [
  "appearance",
  "editor",
  "merge",
  "layout",
  "terminal",
  "github",
  "automation",
  "updates",
  "files",
  "about",
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

/** The MCP server's default port on 127.0.0.1; any free port in the range works. */
export const DEFAULT_MCP_PORT = 48731;
export const MCP_PORT_RANGE = [1024, 65535] as const;
/** Tool switches kept in settings.json; far more than the app has tools. */
export const MAX_MCP_TOOL_STATES = 300;

export const TERMINAL_FONT_WEIGHTS = ["normal", "medium", "bold"] as const;
export const TERMINAL_CURSOR_STYLES = ["block", "bar", "underline"] as const;
export const TERMINAL_LINE_HEIGHT_RANGE = [1, 2] as const;
export const TERMINAL_LETTER_SPACING_RANGE = [0, 5] as const;
export const TERMINAL_SCROLLBACK_RANGE = [1000, 100000] as const;

export const DEFAULT_PANEL_WIDTH = 260;
/** Height of the terminal panel below the editor. */
export const DEFAULT_TERMINAL_HEIGHT = 260;
export const MIN_TERMINAL_HEIGHT = 80;
/** Width of the list of terminals beside the panel, shown with two or more terminals. */
export const DEFAULT_TERMINAL_LIST_WIDTH = 180;
export const MIN_TERMINAL_LIST_WIDTH = 120;
export const MAX_RECENT = 12;

/** JetBrains Mono when it is installed, else VS Code's default editor font on macOS. */
export const DEFAULT_EDITOR_FONT = "'JetBrains Mono', Menlo, Monaco, 'Courier New', monospace";

export const MONOSPACE_FONTS = [
  "Menlo",
  "Monaco",
  "SF Mono",
  "JetBrains Mono",
  "Fira Code",
  "Cascadia Code",
  "Source Code Pro",
  "IBM Plex Mono",
  "Hack",
  "Ubuntu Mono",
  "Courier New",
];

/**
 * Cleans a user-typed font list: drops characters that could escape the CSS
 * value, drops repeated families and makes sure a generic monospace fallback comes last.
 */
export function normalizeFontFamily(value: string): string {
  const cleaned = value.replace(/[;{}<>\\]/g, "").trim().slice(0, 200);
  if (!cleaned) {
    return DEFAULT_EDITOR_FONT;
  }
  const seen = new Set<string>();
  const families = cleaned
    .split(",")
    .map((family) => family.trim())
    .filter((family) => {
      // Picking a font adds it in front of the default list, which may name it already.
      const key = family.replace(/["']/g, "").toLowerCase();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  if (!families.some((family) => family.toLowerCase() === "monospace")) {
    families.push("monospace");
  }
  return families.join(", ");
}

export interface Preferences {
  theme: ThemeSetting;
  /** Color theme id (themes/themeIndex.ts) used while the appearance is light. */
  lightColorTheme: string;
  /** Color theme id used while the appearance is dark. */
  darkColorTheme: string;
  uiFontSize: number;
  editorFontSize: number;
  /** Line height of code, as a multiple of the font size. */
  editorLineHeight: number;
  /** CSS font-family list for code, e.g. "Menlo, Monaco, monospace". */
  editorFontFamily: string;
  /** Render programming ligatures (=>, !=, ===) with fonts that provide them. */
  fontLigatures: boolean;
  tabSize: number;
  wordWrap: boolean;
  renderWhitespace: RenderWhitespace;
  editorCursorStyle: EditorCursorStyle;
  /** Width in pixels of the Line cursor (VS Code's editor.cursorWidth). */
  editorCursorWidth: number;
  editorCursorBlinking: EditorCursorBlinking;
  /** Glide the cursor to its new place instead of jumping (VS Code's editor.cursorSmoothCaretAnimation). */
  editorCursorSmoothCaret: boolean;
  /** Pixels the cursor reaches above the text (Sublime Text's caret_extra_top). */
  editorCaretExtraTop: number;
  /** Pixels the cursor reaches below the text (Sublime Text's caret_extra_bottom). */
  editorCaretExtraBottom: number;
  /** Type the closing bracket or quote with the opening one (VS Code's editor.autoClosingBrackets). */
  editorAutoCloseBrackets: boolean;
  /** Code completion from the words of the file and the language's own lists. */
  editorCompletion: boolean;
  /** The completion list opens while typing; off, only Ctrl+Space opens it. */
  editorCompletionOnTyping: boolean;
  /** Fold arrows beside the line numbers in the file editor. */
  editorFoldGutter: boolean;
  /** Faint vertical lines at each indent level (VS Code's editor.guides.indentation). */
  editorIndentGuides: boolean;
  /** Highlight other uses of the word at the cursor, like JetBrains. */
  editorHighlightWord: boolean;
  /** Scroll the last line up to the top of the file editor (VS Code's editor.scrollBeyondLastLine). */
  editorScrollPastEnd: boolean;
  /** Option+drag selects a rectangle (column selection). */
  editorColumnSelection: boolean;
  /** Column of the right margin line (VS Code's editor.rulers); 0 hides it. */
  editorRulerColumn: number;
  /** Author, date and commit at the end of the cursor line. */
  currentLineBlame: boolean;
  /** Blame column beside the line numbers. */
  blameGutter: boolean;
  /** Ctrl/Cmd + mouse wheel over an editor changes the editor font size. */
  mouseWheelZoom: boolean;
  /** Ask GitHub for new releases every few hours. */
  checkForUpdates: boolean;
  /** "auto" follows betas only when this build is a beta. */
  updateChannel: UpdateChannelSetting;
  ignoreWhitespace: boolean;
  logAllRefs: boolean;
  /** Git > Update Project: merge or rebase the incoming changes, remembered from its dialog. */
  updateMethod: UpdateMethod;
  /** Commit Options: add a Signed-off-by trailer (--signoff) to every commit. */
  commitSignOff: boolean;
  /** Commit Options: GPG signing of every commit. */
  commitGpgSign: CommitGpgSign;
  /** Record the git commands the app runs (Git Console). Off, the console is not loaded at all. */
  gitConsole: boolean;
  /** Shell id (its absolute path) new terminals start; null is the login shell. */
  terminalShell: string | null;
  /** CSS font-family list for the terminal; empty uses the editor font, like VS Code. */
  terminalFontFamily: string;
  terminalFontSize: number;
  /** Multiplier of the font's line height, xterm's `lineHeight`. */
  terminalLineHeight: number;
  /** Extra whole pixels between characters, xterm's `letterSpacing`. */
  terminalLetterSpacing: number;
  terminalFontWeight: TerminalFontWeight;
  /** Weight of bold text (SGR 1). */
  terminalFontWeightBold: TerminalFontWeight;
  terminalLigatures: boolean;
  /** Nerd Font and Powerline symbol fonts are added to the terminal font list as fallbacks. */
  terminalNerdFontIcons: boolean;
  terminalCursorStyle: TerminalCursorStyle;
  terminalCursorBlink: boolean;
  /** Lines kept above the screen. */
  terminalScrollback: number;
  /** Selecting text copies it, like VS Code's terminal.integrated.copyOnSelection. */
  terminalCopyOnSelect: boolean;
  /** Find in the terminal (Cmd+F). Off, the search addon is never loaded. */
  terminalFind: boolean;
  /** Cmd+click opens file paths printed in the terminal, such as `src/app.ts:12:5`. */
  terminalFileLinks: boolean;
  /** Draw with WebGL (xterm's GPU renderer), falling back to the DOM renderer. */
  terminalGpuAcceleration: boolean;
  /** Unicode 11 character widths, so emoji and wide characters line up. */
  terminalUnicode11: boolean;
  /** macOS: Option works as Meta (xterm's macOptionIsMeta) for word jumps and emacs keys. */
  terminalOptionAsMeta: boolean;
  /** A short flash, or a dot on a hidden terminal, when the shell rings the bell. */
  terminalVisualBell: boolean;
  /** Animate scrolling (xterm's smoothScrollDuration). */
  terminalSmoothScrolling: boolean;
  /** Dropping files from Finder on a terminal types their quoted paths. */
  terminalDropPaths: boolean;
  /** How Markdown files open; each file then remembers its own mode for the session. */
  markdownViewMode: MarkdownViewMode;
  /** Files panel: ask before a drag and drop moves files or folders. */
  confirmDragAndDrop: boolean;
  /** The MCP server for AI tools. Off, nothing listens. */
  mcpEnabled: boolean;
  /** The `git-manager cli` command line tool; it talks to the same local server. */
  cliEnabled: boolean;
  /** Port of the local server on 127.0.0.1. */
  mcpPort: number;
  /** Tools switched away from their default (on, or off for destructive ones), by tool name. */
  mcpTools: Record<string, boolean>;
  /** Debug memory log: memory readings and UI events written to ~/.gitmanager/logs/memory.log. */
  memoryLogEnabled: boolean;
  /** How often the memory log reads memory. */
  memoryLogIntervalMs: number;
  /** A reading is written when the total changed by at least this much. */
  memoryLogThresholdMb: number;
}

/** The memory log reads every 100 ms to 10 s, and logs changes of 0 MB (every reading) to 500 MB. */
export const MEMORY_LOG_INTERVAL_RANGE = [100, 10_000] as const;
export const MEMORY_LOG_THRESHOLD_RANGE = [0, 500] as const;

/** Right margin columns; 0 means no margin line. */
export const EDITOR_RULER_RANGE = [1, 500] as const;
/** The column the margin line starts at when it is switched on, like JetBrains. */
export const DEFAULT_RULER_COLUMN = 120;

export const defaultPreferences: Preferences = {
  theme: "system",
  lightColorTheme: DEFAULT_LIGHT_THEME,
  darkColorTheme: DEFAULT_DARK_THEME,
  uiFontSize: 13,
  editorFontSize: 13,
  editorLineHeight: 1.25,
  editorFontFamily: DEFAULT_EDITOR_FONT,
  fontLigatures: false,
  tabSize: 4,
  wordWrap: false,
  renderWhitespace: "selection",
  editorCursorStyle: "line",
  editorCursorWidth: 2,
  editorCursorBlinking: "blink",
  editorCursorSmoothCaret: false,
  editorCaretExtraTop: 0,
  editorCaretExtraBottom: 0,
  editorAutoCloseBrackets: true,
  editorCompletion: true,
  editorCompletionOnTyping: true,
  editorFoldGutter: true,
  editorIndentGuides: true,
  editorHighlightWord: true,
  editorScrollPastEnd: true,
  editorColumnSelection: true,
  editorRulerColumn: 0,
  currentLineBlame: true,
  blameGutter: false,
  mouseWheelZoom: false,
  checkForUpdates: true,
  updateChannel: "auto",
  ignoreWhitespace: false,
  logAllRefs: true,
  updateMethod: "merge",
  commitSignOff: false,
  commitGpgSign: "default",
  gitConsole: false,
  terminalShell: null,
  terminalFontFamily: "",
  terminalFontSize: 13,
  terminalLineHeight: 1.2,
  terminalLetterSpacing: 0,
  terminalFontWeight: "normal",
  terminalFontWeightBold: "bold",
  terminalLigatures: false,
  terminalNerdFontIcons: true,
  terminalCursorStyle: "block",
  terminalCursorBlink: true,
  terminalScrollback: 5000,
  terminalCopyOnSelect: false,
  terminalFind: true,
  terminalFileLinks: true,
  terminalGpuAcceleration: true,
  terminalUnicode11: true,
  terminalOptionAsMeta: false,
  terminalVisualBell: true,
  terminalSmoothScrolling: false,
  terminalDropPaths: true,
  markdownViewMode: "split",
  confirmDragAndDrop: true,
  mcpEnabled: false,
  cliEnabled: false,
  mcpPort: DEFAULT_MCP_PORT,
  memoryLogEnabled: false,
  memoryLogIntervalMs: 500,
  memoryLogThresholdMb: 5,
  mcpTools: {},
};

export const FONT_SIZE_RANGE = { ui: [11, 16], editor: [10, 20], terminal: [9, 24] } as const;
/** Line spacing of code in the editor, diffs and the merge tool. */
export const EDITOR_LINE_HEIGHT_RANGE = [1, 2.5] as const;
export const TAB_SIZES = [2, 4, 8] as const;
export const EDITOR_CURSOR_WIDTH_RANGE = [1, 6] as const;
export const CARET_EXTRA_RANGE = [0, 10] as const;

/** UI state kept in state.json. */
export interface UiState {
  recentRepos: string[];
  /** Recent multi-folder workspaces, each a list of folder roots. */
  recentWorkspaces: string[][];
  /** Folders open when the app last closed, reopened on start. */
  lastSession: string[];
  /** Workspace file open when the app last closed; takes priority over `lastSession`. */
  lastSessionFile: string | null;
  /**
   * state.json recorded a session, even an empty one. Only data written before
   * sessions existed lacks it; an empty recorded session means the user closed
   * the folder on purpose.
   */
  sessionRecorded: boolean;
  /** Recently used workspace files. */
  recentWorkspaceFiles: string[];
  /** Version that last ran, to show What's New once after an update. */
  lastRunVersion: string | null;
  /** A release the user chose to skip; it is not announced again. */
  skippedVersion: string | null;
  activeRepos: Record<string, string>;
  /** Scripts panel: the Node version each package.json runs with, by file path: a bin folder, or "default" for the shell's. */
  scriptNodeVersions: Record<string, string>;
  explorerOpen: boolean;
  /** The icon strips at the left and right edges of the window (VS Code's activity bars). */
  leftBarVisible: boolean;
  rightBarVisible: boolean;
  /** The left side's share of a side-by-side diff (see src/lib/diff/split.ts). */
  diffSplitRatio: number;
  leftPanel: LeftPanel;
  sidebarWidth: number;
  explorerWidth: number;
  /** Height of the terminal panel. */
  terminalHeight: number;
  /** Width of the terminal list beside the panel. */
  terminalListWidth: number;
  /** Share of the editor area the Markdown preview takes beside the source. */
  markdownPreviewRatio: number;
}

export type Json = Record<string, unknown>;

export function asObject(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};
}

function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function pickNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

/** Rounds to the nearest step, so 1.5499999 is saved as 1.55. */
function roundTo(value: number, step: number): number {
  return Math.round(Math.round(value / step) * step * 100) / 100;
}

function pickStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function pickString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function pickOneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly unknown[]).includes(value) ? (value as T) : fallback;
}

/** Like pickNumber, rounded to a whole number first. */
function pickInteger(value: unknown, fallback: number, min: number, max: number): number {
  return pickNumber(typeof value === "number" ? Math.round(value) : value, fallback, min, max);
}

/** Rounded to tenths so a hand-edited 1.234 matches what the slider can show. */
function pickTenths(value: unknown, fallback: number, min: number, max: number): number {
  return pickNumber(typeof value === "number" ? Math.round(value * 10) / 10 : value, fallback, min, max);
}

/** A margin column from Settings or settings.json: a whole column in range, or 0 (off) for anything else. */
export function pickRulerColumn(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.round(value) <= 0) {
    return 0;
  }
  return pickInteger(value, 0, ...EDITOR_RULER_RANGE);
}

/** A scrollback typed in Settings or found in settings.json: whole lines, clamped; anything else is the default. */
export function clampTerminalScrollback(value: unknown): number {
  return pickInteger(value, defaultPreferences.terminalScrollback, ...TERMINAL_SCROLLBACK_RANGE);
}

/** Empty (or only spaces) means "use the editor font"; anything else is cleaned like the editor font. */
export function normalizeTerminalFontFamily(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }
  return normalizeFontFamily(value);
}

/** A shell is an absolute path; anything else (or an empty string) means the login shell. */
function pickShell(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const shell = value.trim();
  return shell && shell.length <= 1024 && !shell.includes("\0") ? shell : null;
}

/** A port typed in Settings or found in settings.json: a whole number in range, else null. */
export function parseMcpPort(value: unknown): number | null {
  const port = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof port !== "number" || !Number.isInteger(port)) {
    return null;
  }
  return port >= MCP_PORT_RANGE[0] && port <= MCP_PORT_RANGE[1] ? port : null;
}

const TOOL_NAME = /^[a-z][a-z0-9_]{0,63}$/;

/** Only tool names with a true or false are kept, at most MAX_MCP_TOOL_STATES of them. */
export function pickToolStates(value: unknown): Record<string, boolean> {
  return Object.fromEntries(
    Object.entries(asObject(value))
      .filter((entry): entry is [string, boolean] => TOOL_NAME.test(entry[0]) && typeof entry[1] === "boolean")
      .slice(0, MAX_MCP_TOOL_STATES),
  );
}

/** Node version choices kept in state.json; the oldest go first. */
export const MAX_SCRIPT_NODE_VERSIONS = 200;

/** Keys of state.json we understand; others are kept as they are. */
const STATE_KEYS = [
  "recentWorkspaces",
  "lastSession",
  "lastSessionFile",
  "recentWorkspaceFiles",
  "lastRunVersion",
  "skippedVersion",
  "recentFolders",
  "recentRepos",
  "activeRepos",
  "scriptNodeVersions",
  "explorerOpen",
  "leftBarVisible",
  "rightBarVisible",
  "diffSplitRatio",
  "leftPanel",
  "sidebarWidth",
  "explorerWidth",
  "terminalHeight",
  "terminalListWidth",
  "markdownPreviewRatio",
];

/** Validates settings.json; unknown keys come back in `extra` so a save keeps them. */
export function parsePreferences(value: unknown): { preferences: Preferences; extra: Json } {
  const data = asObject(value);
  const theme = data.theme;
  const channel = data.updateChannel;
  const preferences: Preferences = {
    theme: theme === "light" || theme === "dark" || theme === "system" ? theme : defaultPreferences.theme,
    lightColorTheme: pickThemeId(data.lightColorTheme, "light"),
    darkColorTheme: pickThemeId(data.darkColorTheme, "dark"),
    uiFontSize: pickNumber(data.uiFontSize, defaultPreferences.uiFontSize, ...FONT_SIZE_RANGE.ui),
    editorFontSize: pickNumber(data.editorFontSize, defaultPreferences.editorFontSize, ...FONT_SIZE_RANGE.editor),
    editorLineHeight: roundTo(
      pickNumber(data.editorLineHeight, defaultPreferences.editorLineHeight, ...EDITOR_LINE_HEIGHT_RANGE),
      0.05,
    ),
    editorFontFamily: typeof data.editorFontFamily === "string" ? normalizeFontFamily(data.editorFontFamily) : DEFAULT_EDITOR_FONT,
    fontLigatures: pickBoolean(data.fontLigatures, defaultPreferences.fontLigatures),
    tabSize: (TAB_SIZES as readonly unknown[]).includes(data.tabSize) ? (data.tabSize as number) : defaultPreferences.tabSize,
    wordWrap: pickBoolean(data.wordWrap, defaultPreferences.wordWrap),
    renderWhitespace: pickOneOf(data.renderWhitespace, RENDER_WHITESPACE_VALUES, defaultPreferences.renderWhitespace),
    editorCursorStyle: pickOneOf(data.editorCursorStyle, EDITOR_CURSOR_STYLES, defaultPreferences.editorCursorStyle),
    editorCursorWidth: pickInteger(data.editorCursorWidth, defaultPreferences.editorCursorWidth, ...EDITOR_CURSOR_WIDTH_RANGE),
    editorCursorBlinking: pickOneOf(data.editorCursorBlinking, EDITOR_CURSOR_BLINKINGS, defaultPreferences.editorCursorBlinking),
    editorCursorSmoothCaret: pickBoolean(data.editorCursorSmoothCaret, defaultPreferences.editorCursorSmoothCaret),
    editorCaretExtraTop: pickInteger(data.editorCaretExtraTop, defaultPreferences.editorCaretExtraTop, ...CARET_EXTRA_RANGE),
    editorCaretExtraBottom: pickInteger(data.editorCaretExtraBottom, defaultPreferences.editorCaretExtraBottom, ...CARET_EXTRA_RANGE),
    editorAutoCloseBrackets: pickBoolean(data.editorAutoCloseBrackets, defaultPreferences.editorAutoCloseBrackets),
    editorCompletion: pickBoolean(data.editorCompletion, defaultPreferences.editorCompletion),
    editorCompletionOnTyping: pickBoolean(data.editorCompletionOnTyping, defaultPreferences.editorCompletionOnTyping),
    editorFoldGutter: pickBoolean(data.editorFoldGutter, defaultPreferences.editorFoldGutter),
    editorIndentGuides: pickBoolean(data.editorIndentGuides, defaultPreferences.editorIndentGuides),
    editorHighlightWord: pickBoolean(data.editorHighlightWord, defaultPreferences.editorHighlightWord),
    editorScrollPastEnd: pickBoolean(data.editorScrollPastEnd, defaultPreferences.editorScrollPastEnd),
    editorColumnSelection: pickBoolean(data.editorColumnSelection, defaultPreferences.editorColumnSelection),
    editorRulerColumn: pickRulerColumn(data.editorRulerColumn),
    currentLineBlame: pickBoolean(data.currentLineBlame, defaultPreferences.currentLineBlame),
    blameGutter: pickBoolean(data.blameGutter, defaultPreferences.blameGutter),
    mouseWheelZoom: pickBoolean(data.mouseWheelZoom, defaultPreferences.mouseWheelZoom),
    checkForUpdates: pickBoolean(data.checkForUpdates, defaultPreferences.checkForUpdates),
    updateChannel: channel === "stable" || channel === "beta" || channel === "auto" ? channel : defaultPreferences.updateChannel,
    ignoreWhitespace: pickBoolean(data.ignoreWhitespace, defaultPreferences.ignoreWhitespace),
    logAllRefs: pickBoolean(data.logAllRefs, defaultPreferences.logAllRefs),
    updateMethod: pickOneOf(data.updateMethod, UPDATE_METHODS, defaultPreferences.updateMethod),
    commitSignOff: pickBoolean(data.commitSignOff, defaultPreferences.commitSignOff),
    commitGpgSign: pickOneOf(data.commitGpgSign, COMMIT_GPG_SIGNS, defaultPreferences.commitGpgSign),
    gitConsole: pickBoolean(data.gitConsole, defaultPreferences.gitConsole),
    terminalShell: pickShell(data.terminalShell),
    terminalFontFamily: normalizeTerminalFontFamily(data.terminalFontFamily),
    terminalFontSize: pickNumber(data.terminalFontSize, defaultPreferences.terminalFontSize, ...FONT_SIZE_RANGE.terminal),
    terminalLineHeight: pickTenths(data.terminalLineHeight, defaultPreferences.terminalLineHeight, ...TERMINAL_LINE_HEIGHT_RANGE),
    terminalLetterSpacing: pickInteger(
      data.terminalLetterSpacing,
      defaultPreferences.terminalLetterSpacing,
      ...TERMINAL_LETTER_SPACING_RANGE,
    ),
    terminalFontWeight: pickOneOf(data.terminalFontWeight, TERMINAL_FONT_WEIGHTS, defaultPreferences.terminalFontWeight),
    terminalFontWeightBold: pickOneOf(data.terminalFontWeightBold, TERMINAL_FONT_WEIGHTS, defaultPreferences.terminalFontWeightBold),
    terminalLigatures: pickBoolean(data.terminalLigatures, defaultPreferences.terminalLigatures),
    terminalNerdFontIcons: pickBoolean(data.terminalNerdFontIcons, defaultPreferences.terminalNerdFontIcons),
    terminalCursorStyle: pickOneOf(data.terminalCursorStyle, TERMINAL_CURSOR_STYLES, defaultPreferences.terminalCursorStyle),
    terminalCursorBlink: pickBoolean(data.terminalCursorBlink, defaultPreferences.terminalCursorBlink),
    terminalScrollback: clampTerminalScrollback(data.terminalScrollback),
    terminalCopyOnSelect: pickBoolean(data.terminalCopyOnSelect, defaultPreferences.terminalCopyOnSelect),
    terminalFind: pickBoolean(data.terminalFind, defaultPreferences.terminalFind),
    terminalFileLinks: pickBoolean(data.terminalFileLinks, defaultPreferences.terminalFileLinks),
    terminalGpuAcceleration: pickBoolean(data.terminalGpuAcceleration, defaultPreferences.terminalGpuAcceleration),
    terminalUnicode11: pickBoolean(data.terminalUnicode11, defaultPreferences.terminalUnicode11),
    terminalOptionAsMeta: pickBoolean(data.terminalOptionAsMeta, defaultPreferences.terminalOptionAsMeta),
    terminalVisualBell: pickBoolean(data.terminalVisualBell, defaultPreferences.terminalVisualBell),
    terminalSmoothScrolling: pickBoolean(data.terminalSmoothScrolling, defaultPreferences.terminalSmoothScrolling),
    terminalDropPaths: pickBoolean(data.terminalDropPaths, defaultPreferences.terminalDropPaths),
    markdownViewMode: pickOneOf(data.markdownViewMode, MARKDOWN_VIEW_MODES, defaultPreferences.markdownViewMode),
    confirmDragAndDrop: pickBoolean(data.confirmDragAndDrop, defaultPreferences.confirmDragAndDrop),
    mcpEnabled: pickBoolean(data.mcpEnabled, defaultPreferences.mcpEnabled),
    cliEnabled: pickBoolean(data.cliEnabled, defaultPreferences.cliEnabled),
    mcpPort: parseMcpPort(data.mcpPort) ?? defaultPreferences.mcpPort,
    mcpTools: pickToolStates(data.mcpTools),
    memoryLogEnabled: pickBoolean(data.memoryLogEnabled, defaultPreferences.memoryLogEnabled),
    memoryLogIntervalMs: pickInteger(data.memoryLogIntervalMs, defaultPreferences.memoryLogIntervalMs, ...MEMORY_LOG_INTERVAL_RANGE),
    memoryLogThresholdMb: pickNumber(data.memoryLogThresholdMb, defaultPreferences.memoryLogThresholdMb, ...MEMORY_LOG_THRESHOLD_RANGE),
  };
  const known = new Set(Object.keys(defaultPreferences));
  // Legacy browser storage mixed state into the same object; keep only real extras.
  const stateKeys = new Set(STATE_KEYS);
  const extra = Object.fromEntries(Object.entries(data).filter(([key]) => !known.has(key) && !stateKeys.has(key)));
  return { preferences, extra };
}

/** Preference keys whose value differs from the default, in display order; records compare by content. */
export function changedPreferenceKeys(current: Preferences): (keyof Preferences)[] {
  return (Object.keys(defaultPreferences) as (keyof Preferences)[]).filter((key) => {
    const value = current[key];
    const fallback = defaultPreferences[key];
    if (typeof value === "object" && value !== null) {
      return JSON.stringify(value) !== JSON.stringify(fallback);
    }
    return value !== fallback;
  });
}

/** Validates state.json; unknown keys come back in `extra` so a save keeps them. */
export function parseState(value: unknown): { state: UiState; extra: Json } {
  const data = asObject(value);
  const panel = data.leftPanel;
  const state: UiState = {
    // Older data called recent folders "recentRepos".
    recentRepos: pickStrings(data.recentFolders ?? data.recentRepos).slice(0, MAX_RECENT),
    recentWorkspaces: (Array.isArray(data.recentWorkspaces) ? data.recentWorkspaces : [])
      .map((folders: unknown) => pickStrings(folders))
      .filter((folders: string[]) => folders.length > 1)
      .slice(0, MAX_RECENT),
    lastSession: pickStrings(data.lastSession),
    lastSessionFile: pickString(data.lastSessionFile),
    sessionRecorded: Array.isArray(data.lastSession),
    recentWorkspaceFiles: pickStrings(data.recentWorkspaceFiles).slice(0, MAX_RECENT),
    lastRunVersion: pickString(data.lastRunVersion),
    skippedVersion: pickString(data.skippedVersion),
    activeRepos: Object.fromEntries(
      Object.entries(asObject(data.activeRepos)).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    ),
    scriptNodeVersions: Object.fromEntries(
      Object.entries(asObject(data.scriptNodeVersions))
        .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== "")
        .slice(-MAX_SCRIPT_NODE_VERSIONS),
    ),
    explorerOpen: pickBoolean(data.explorerOpen, true),
    leftBarVisible: pickBoolean(data.leftBarVisible, true),
    rightBarVisible: pickBoolean(data.rightBarVisible, true),
    diffSplitRatio: pickNumber(data.diffSplitRatio, 0.5, 0.15, 0.85),
    leftPanel: panel === "changes" || panel === "branches" || panel === "scripts" || panel === null ? panel : "changes",
    sidebarWidth: pickNumber(data.sidebarWidth, DEFAULT_PANEL_WIDTH, 120, 2000),
    explorerWidth: pickNumber(data.explorerWidth, DEFAULT_PANEL_WIDTH, 120, 2000),
    terminalHeight: pickNumber(data.terminalHeight, DEFAULT_TERMINAL_HEIGHT, MIN_TERMINAL_HEIGHT, 2000),
    terminalListWidth: pickNumber(data.terminalListWidth, DEFAULT_TERMINAL_LIST_WIDTH, MIN_TERMINAL_LIST_WIDTH, 1200),
    markdownPreviewRatio: pickNumber(data.markdownPreviewRatio, DEFAULT_MARKDOWN_PREVIEW_RATIO, ...MARKDOWN_PREVIEW_RATIO_RANGE),
  };
  const known = new Set([...STATE_KEYS, ...Object.keys(defaultPreferences)]);
  const extra = Object.fromEntries(Object.entries(data).filter(([key]) => !known.has(key)));
  return { state, extra };
}

/** The JSON written to state.json. */
export function stateToJson(state: UiState, extra: Json): Json {
  return {
    ...extra,
    recentFolders: state.recentRepos,
    recentWorkspaces: state.recentWorkspaces,
    lastSession: state.lastSession,
    lastSessionFile: state.lastSessionFile,
    recentWorkspaceFiles: state.recentWorkspaceFiles,
    lastRunVersion: state.lastRunVersion,
    skippedVersion: state.skippedVersion,
    activeRepos: state.activeRepos,
    scriptNodeVersions: state.scriptNodeVersions,
    explorerOpen: state.explorerOpen,
    leftBarVisible: state.leftBarVisible,
    rightBarVisible: state.rightBarVisible,
    diffSplitRatio: state.diffSplitRatio,
    leftPanel: state.leftPanel,
    sidebarWidth: state.sidebarWidth,
    explorerWidth: state.explorerWidth,
    terminalHeight: state.terminalHeight,
    terminalListWidth: state.terminalListWidth,
    markdownPreviewRatio: state.markdownPreviewRatio,
  };
}

/** Parse errors per file; null when the file was read fine or does not exist. */
export type LoadErrors = Record<ConfigName, string | null>;

/**
 * Files a save may write. A file that failed to parse is never overwritten
 * automatically: the user may be fixing it by hand, and it may still hold
 * their recent folders or preferences.
 */
export function writableConfigs(loadErrors: LoadErrors): ConfigName[] {
  return (["state", "settings"] as const).filter((configName) => loadErrors[configName] === null);
}

/** Old browser-storage settings are migrated only on a real first run: no files and no errors. */
export function shouldMigrateLegacy(loaded: Record<ConfigName, unknown>, loadErrors: LoadErrors): boolean {
  return loaded.settings === null && loaded.state === null && loadErrors.settings === null && loadErrors.state === null;
}

export type SessionStep = { kind: "workspaceFile"; filePath: string } | { kind: "folders"; folderPaths: string[] };

/**
 * What to reopen on start without a folder argument, tried in order until one
 * opens. An empty recorded session means the user closed the folder, so the
 * welcome screen shows; the most recent folder is only a fallback for state
 * written before sessions were recorded.
 */
export function sessionSteps(
  state: Pick<UiState, "lastSession" | "lastSessionFile" | "sessionRecorded" | "recentRepos">,
): SessionStep[] {
  const steps: SessionStep[] = [];
  if (state.lastSessionFile) {
    steps.push({ kind: "workspaceFile", filePath: state.lastSessionFile });
  }
  if (state.lastSession.length > 0) {
    steps.push({ kind: "folders", folderPaths: state.lastSession });
  } else if (!state.sessionRecorded && state.recentRepos[0]) {
    steps.push({ kind: "folders", folderPaths: [state.recentRepos[0]] });
  }
  return steps;
}
