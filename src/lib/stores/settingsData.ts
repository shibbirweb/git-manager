// Pure parts of the settings store: validating what ~/.gitmanager/settings.json
// and state.json hold, turning it back into JSON, deciding which files may be
// written and which session to restore on start. Kept free of Svelte and Tauri
// so it can be tested directly.

export type ThemeSetting = "system" | "light" | "dark";

/** Which panel the left sidebar shows; null hides it. */
export type LeftPanel = "changes" | "branches" | null;

export type UpdateChannelSetting = "auto" | "stable" | "beta";

export type ConfigName = "settings" | "state";

export const DEFAULT_PANEL_WIDTH = 260;
export const MAX_RECENT = 12;

/** VS Code's default editor font on macOS. */
export const DEFAULT_EDITOR_FONT = "Menlo, Monaco, 'Courier New', monospace";

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
 * value and makes sure a generic monospace fallback comes last.
 */
export function normalizeFontFamily(value: string): string {
  const cleaned = value.replace(/[;{}<>\\]/g, "").trim().slice(0, 200);
  if (!cleaned) {
    return DEFAULT_EDITOR_FONT;
  }
  const families = cleaned
    .split(",")
    .map((family) => family.trim())
    .filter(Boolean);
  if (!families.some((family) => family.toLowerCase() === "monospace")) {
    families.push("monospace");
  }
  return families.join(", ");
}

export interface Preferences {
  theme: ThemeSetting;
  uiFontSize: number;
  editorFontSize: number;
  /** CSS font-family list for code, e.g. "Menlo, Monaco, monospace". */
  editorFontFamily: string;
  /** Render programming ligatures (=>, !=, ===) with fonts that provide them. */
  fontLigatures: boolean;
  tabSize: number;
  wordWrap: boolean;
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
}

export const defaultPreferences: Preferences = {
  theme: "system",
  uiFontSize: 13,
  editorFontSize: 12.5,
  editorFontFamily: DEFAULT_EDITOR_FONT,
  fontLigatures: false,
  tabSize: 4,
  wordWrap: false,
  currentLineBlame: true,
  blameGutter: false,
  mouseWheelZoom: false,
  checkForUpdates: true,
  updateChannel: "auto",
  ignoreWhitespace: false,
  logAllRefs: true,
};

export const FONT_SIZE_RANGE = { ui: [11, 16], editor: [10, 20] } as const;
export const TAB_SIZES = [2, 4, 8] as const;

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
  explorerOpen: boolean;
  leftPanel: LeftPanel;
  sidebarWidth: number;
  explorerWidth: number;
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

function pickStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function pickString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

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
  "explorerOpen",
  "leftPanel",
  "sidebarWidth",
  "explorerWidth",
];

/** Validates settings.json; unknown keys come back in `extra` so a save keeps them. */
export function parsePreferences(value: unknown): { preferences: Preferences; extra: Json } {
  const data = asObject(value);
  const theme = data.theme;
  const channel = data.updateChannel;
  const preferences: Preferences = {
    theme: theme === "light" || theme === "dark" || theme === "system" ? theme : defaultPreferences.theme,
    uiFontSize: pickNumber(data.uiFontSize, defaultPreferences.uiFontSize, ...FONT_SIZE_RANGE.ui),
    editorFontSize: pickNumber(data.editorFontSize, defaultPreferences.editorFontSize, ...FONT_SIZE_RANGE.editor),
    editorFontFamily: typeof data.editorFontFamily === "string" ? normalizeFontFamily(data.editorFontFamily) : DEFAULT_EDITOR_FONT,
    fontLigatures: pickBoolean(data.fontLigatures, defaultPreferences.fontLigatures),
    tabSize: (TAB_SIZES as readonly unknown[]).includes(data.tabSize) ? (data.tabSize as number) : defaultPreferences.tabSize,
    wordWrap: pickBoolean(data.wordWrap, defaultPreferences.wordWrap),
    currentLineBlame: pickBoolean(data.currentLineBlame, defaultPreferences.currentLineBlame),
    blameGutter: pickBoolean(data.blameGutter, defaultPreferences.blameGutter),
    mouseWheelZoom: pickBoolean(data.mouseWheelZoom, defaultPreferences.mouseWheelZoom),
    checkForUpdates: pickBoolean(data.checkForUpdates, defaultPreferences.checkForUpdates),
    updateChannel: channel === "stable" || channel === "beta" || channel === "auto" ? channel : defaultPreferences.updateChannel,
    ignoreWhitespace: pickBoolean(data.ignoreWhitespace, defaultPreferences.ignoreWhitespace),
    logAllRefs: pickBoolean(data.logAllRefs, defaultPreferences.logAllRefs),
  };
  const known = new Set(Object.keys(defaultPreferences));
  // Legacy browser storage mixed state into the same object; keep only real extras.
  const stateKeys = new Set(STATE_KEYS);
  const extra = Object.fromEntries(Object.entries(data).filter(([key]) => !known.has(key) && !stateKeys.has(key)));
  return { preferences, extra };
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
    explorerOpen: pickBoolean(data.explorerOpen, true),
    leftPanel: panel === "changes" || panel === "branches" || panel === null ? panel : "changes",
    sidebarWidth: pickNumber(data.sidebarWidth, DEFAULT_PANEL_WIDTH, 120, 2000),
    explorerWidth: pickNumber(data.explorerWidth, DEFAULT_PANEL_WIDTH, 120, 2000),
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
    explorerOpen: state.explorerOpen,
    leftPanel: state.leftPanel,
    sidebarWidth: state.sidebarWidth,
    explorerWidth: state.explorerWidth,
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
