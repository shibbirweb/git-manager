// User preferences and UI state, stored like VS Code in the home folder:
//   ~/.gitmanager/settings.json   preferences shown in the Settings dialog
//   ~/.gitmanager/state.json      recent folders, panel sizes and similar
// Values are validated on load so a hand-edited file can never break the app,
// and unknown keys are preserved on save. A file that fails to parse only
// affects itself and is never overwritten automatically. The pure parts live
// in settingsData.ts.

import { api, errorMessage } from "$lib/api";
import { applyColorTheme } from "$lib/themes/apply";
import { type ColorMode, effectiveMode, pickThemeId } from "$lib/themes/themeIndex";
import { toast } from "$lib/ui/toast.svelte";
import {
  asObject,
  changedPreferenceKeys,
  type ConfigName,
  type Json,
  type LeftPanel,
  type LoadErrors,
  MARKDOWN_PREVIEW_RATIO_RANGE,
  type MarkdownViewMode,
  MAX_RECENT,
  MAX_SCRIPT_NODE_VERSIONS,
  type EditorCursorBlinking,
  type EditorCursorStyle,
  parsePreferences,
  parseState,
  type Preferences,
  type RenderWhitespace,
  type SettingsSection,
  shouldMigrateLegacy,
  stateToJson,
  type TerminalCursorStyle,
  type TerminalFontWeight,
  type ThemeSetting,
  type UiState,
  type UpdateChannelSetting,
  type UpdateMethod,
  writableConfigs,
} from "./settingsData";
import type { CommitGpgSign } from "./settingsData";

export {
  MEMORY_LOG_INTERVAL_RANGE,
  MEMORY_LOG_THRESHOLD_RANGE,
  clampTerminalScrollback,
  DEFAULT_EDITOR_FONT,
  DEFAULT_MARKDOWN_PREVIEW_RATIO,
  DEFAULT_MCP_PORT,
  DEFAULT_PANEL_WIDTH,
  DEFAULT_TERMINAL_HEIGHT,
  DEFAULT_TERMINAL_LIST_WIDTH,
  defaultPreferences,
  CARET_EXTRA_RANGE,
  EDITOR_CURSOR_BLINKING_CHOICES,
  EDITOR_CURSOR_STYLE_CHOICES,
  EDITOR_CURSOR_WIDTH_RANGE,
  EDITOR_LINE_HEIGHT_RANGE,
  FONT_SIZE_RANGE,
  MARKDOWN_PREVIEW_RATIO_RANGE,
  MARKDOWN_VIEW_MODES,
  MCP_PORT_RANGE,
  MIN_TERMINAL_HEIGHT,
  MIN_TERMINAL_LIST_WIDTH,
  MONOSPACE_FONTS,
  normalizeFontFamily,
  normalizeTerminalFontFamily,
  parseMcpPort,
  RENDER_WHITESPACE_CHOICES,
  SETTINGS_SECTIONS,
  TAB_SIZES,
  TERMINAL_CURSOR_STYLES,
  TERMINAL_FONT_WEIGHTS,
  TERMINAL_LETTER_SPACING_RANGE,
  TERMINAL_LINE_HEIGHT_RANGE,
  TERMINAL_SCROLLBACK_RANGE,
} from "./settingsData";
export type {
  EditorCursorBlinking,
  EditorCursorStyle,
  LeftPanel,
  MarkdownViewMode,
  Preferences,
  RenderWhitespace,
  SettingsSection,
  TerminalCursorStyle,
  TerminalFontWeight,
  ThemeSetting,
  UpdateChannelSetting,
  UpdateMethod,
} from "./settingsData";

const SAVE_DELAY_MS = 200;
/** Where settings lived before ~/.gitmanager existed; migrated once. */
const LEGACY_STORAGE_KEY = "git-merger:settings";

const initialPreferences = parsePreferences({}).preferences;
const initialState = parseState({}).state;

class SettingsStore {
  // Preferences (settings.json)
  theme = $state<ThemeSetting>(initialPreferences.theme);
  lightColorTheme = $state(initialPreferences.lightColorTheme);
  darkColorTheme = $state(initialPreferences.darkColorTheme);
  uiFontSize = $state(initialPreferences.uiFontSize);
  editorFontSize = $state(initialPreferences.editorFontSize);
  editorLineHeight = $state(initialPreferences.editorLineHeight);
  editorFontFamily = $state(initialPreferences.editorFontFamily);
  fontLigatures = $state(initialPreferences.fontLigatures);
  tabSize = $state(initialPreferences.tabSize);
  wordWrap = $state(initialPreferences.wordWrap);
  renderWhitespace = $state<RenderWhitespace>(initialPreferences.renderWhitespace);
  editorCursorStyle = $state<EditorCursorStyle>(initialPreferences.editorCursorStyle);
  editorCursorWidth = $state(initialPreferences.editorCursorWidth);
  editorCursorBlinking = $state<EditorCursorBlinking>(initialPreferences.editorCursorBlinking);
  editorCursorSmoothCaret = $state(initialPreferences.editorCursorSmoothCaret);
  editorCaretExtraTop = $state(initialPreferences.editorCaretExtraTop);
  editorCaretExtraBottom = $state(initialPreferences.editorCaretExtraBottom);
  currentLineBlame = $state(initialPreferences.currentLineBlame);
  blameGutter = $state(initialPreferences.blameGutter);
  mouseWheelZoom = $state(initialPreferences.mouseWheelZoom);
  checkForUpdates = $state(initialPreferences.checkForUpdates);
  updateChannel = $state<UpdateChannelSetting>(initialPreferences.updateChannel);
  ignoreWhitespace = $state(initialPreferences.ignoreWhitespace);
  logAllRefs = $state(initialPreferences.logAllRefs);
  updateMethod = $state<UpdateMethod>(initialPreferences.updateMethod);
  commitSignOff = $state(initialPreferences.commitSignOff);
  commitGpgSign = $state<CommitGpgSign>(initialPreferences.commitGpgSign);
  gitConsole = $state(initialPreferences.gitConsole);
  terminalShell = $state<string | null>(initialPreferences.terminalShell);
  terminalFontFamily = $state(initialPreferences.terminalFontFamily);
  terminalFontSize = $state(initialPreferences.terminalFontSize);
  terminalLineHeight = $state(initialPreferences.terminalLineHeight);
  terminalLetterSpacing = $state(initialPreferences.terminalLetterSpacing);
  terminalFontWeight = $state<TerminalFontWeight>(initialPreferences.terminalFontWeight);
  terminalFontWeightBold = $state<TerminalFontWeight>(initialPreferences.terminalFontWeightBold);
  terminalLigatures = $state(initialPreferences.terminalLigatures);
  terminalNerdFontIcons = $state(initialPreferences.terminalNerdFontIcons);
  terminalCursorStyle = $state<TerminalCursorStyle>(initialPreferences.terminalCursorStyle);
  terminalCursorBlink = $state(initialPreferences.terminalCursorBlink);
  terminalScrollback = $state(initialPreferences.terminalScrollback);
  terminalCopyOnSelect = $state(initialPreferences.terminalCopyOnSelect);
  markdownViewMode = $state<MarkdownViewMode>(initialPreferences.markdownViewMode);
  confirmDragAndDrop = $state(initialPreferences.confirmDragAndDrop);
  mcpEnabled = $state(initialPreferences.mcpEnabled);
  cliEnabled = $state(initialPreferences.cliEnabled);
  memoryLogEnabled = $state(initialPreferences.memoryLogEnabled);
  memoryLogIntervalMs = $state(initialPreferences.memoryLogIntervalMs);
  memoryLogThresholdMb = $state(initialPreferences.memoryLogThresholdMb);
  mcpPort = $state(initialPreferences.mcpPort);
  mcpTools = $state.raw<Record<string, boolean>>(initialPreferences.mcpTools);

  // UI state (state.json)
  recentRepos = $state<string[]>(initialState.recentRepos);
  /** Recent multi-folder workspaces, each a list of folder roots. */
  recentWorkspaces = $state<string[][]>(initialState.recentWorkspaces);
  /** Folders open when the app last closed, reopened on start. */
  lastSession = $state<string[]>(initialState.lastSession);
  /** Workspace file open when the app last closed; takes priority over `lastSession`. */
  lastSessionFile = $state<string | null>(initialState.lastSessionFile);
  /** state.json recorded a session; an empty one means the folder was closed on purpose. */
  sessionRecorded = $state(initialState.sessionRecorded);
  /** Recently used workspace files. */
  recentWorkspaceFiles = $state<string[]>(initialState.recentWorkspaceFiles);
  /** Version that last ran, to show What's New once after an update. */
  lastRunVersion = $state<string | null>(initialState.lastRunVersion);
  /** A release the user chose to skip; it is not announced again. */
  skippedVersion = $state<string | null>(initialState.skippedVersion);
  activeRepos = $state<Record<string, string>>(initialState.activeRepos);
  scriptNodeVersions = $state<Record<string, string>>(initialState.scriptNodeVersions);
  explorerOpen = $state(initialState.explorerOpen);
  leftBarVisible = $state(initialState.leftBarVisible);
  rightBarVisible = $state(initialState.rightBarVisible);
  diffSplitRatio = $state(initialState.diffSplitRatio);
  leftPanel = $state<LeftPanel>(initialState.leftPanel);
  sidebarWidth = $state(initialState.sidebarWidth);
  explorerWidth = $state(initialState.explorerWidth);
  terminalHeight = $state(initialState.terminalHeight);
  terminalListWidth = $state(initialState.terminalListWidth);
  markdownPreviewRatio = $state(initialState.markdownPreviewRatio);

  /** macOS is in dark mode; followed while `theme` is "system". */
  systemDark = $state(false);
  private systemMedia: MediaQueryList | null = null;

  /** The Settings dialog is open (not saved). */
  dialogOpen = $state(false);
  /** Section the Settings dialog opens on. */
  dialogSection = $state<SettingsSection>("appearance");

  /** The ~/.gitmanager folder, once known. */
  configDir = $state<string | null>(null);
  /** Set when settings.json could not be read, e.g. after a hand edit with a typo. */
  loadError = $state<string | null>(null);
  /** Set when state.json could not be read; it is then left as it is until reset. */
  stateLoadError = $state<string | null>(null);

  private extraPreferences: Json = {};
  private extraState: Json = {};
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private saveFailed = false;

  /** Loads both files; migrates the old browser-storage settings on first run. */
  async init(): Promise<void> {
    try {
      this.configDir = await api.configDir();
    } catch {
      this.configDir = null;
    }
    // Each file is read on its own so a typo in one never resets the other.
    const [preferences, state] = await Promise.all([this.loadFile("settings"), this.loadFile("state")]);
    this.loadError = preferences.error;
    this.stateLoadError = state.error;
    const loaded = { settings: preferences.value, state: state.value };
    if (shouldMigrateLegacy(loaded, this.loadErrors)) {
      const legacy = this.readLegacy();
      if (legacy) {
        this.applyPreferences(legacy);
        this.applyState(legacy);
        this.flush();
      }
    } else {
      this.applyPreferences(preferences.value);
      this.applyState(state.value);
    }
    this.applyAppearance();
    if (this.loadError || this.stateLoadError) {
      const file = this.loadError && this.stateLoadError ? "settings.json and state.json" : this.loadError ? "settings.json" : "state.json";
      toast.error(`${file} could not be read`, "It is left as it is. Open Settings to try again or reset it.");
    }
  }

  private async loadFile(configName: ConfigName): Promise<{ value: unknown; error: string | null }> {
    try {
      return { value: await api.loadConfig(configName), error: null };
    } catch (error) {
      return { value: null, error: errorMessage(error) };
    }
  }

  private get loadErrors(): LoadErrors {
    return { settings: this.loadError, state: this.stateLoadError };
  }

  private readLegacy(): Json | null {
    try {
      const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      return raw ? asObject(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }

  private applyPreferences(value: unknown): void {
    const { preferences, extra } = parsePreferences(value);
    Object.assign(this, preferences);
    this.extraPreferences = extra;
  }

  private applyState(value: unknown): void {
    const { state, extra } = parseState(value);
    Object.assign(this, state);
    this.extraState = extra;
  }

  preferences(): Preferences {
    return {
      theme: this.theme,
      lightColorTheme: this.lightColorTheme,
      darkColorTheme: this.darkColorTheme,
      uiFontSize: this.uiFontSize,
      editorFontSize: this.editorFontSize,
      editorLineHeight: this.editorLineHeight,
      editorFontFamily: this.editorFontFamily,
      fontLigatures: this.fontLigatures,
      tabSize: this.tabSize,
      wordWrap: this.wordWrap,
      renderWhitespace: this.renderWhitespace,
      editorCursorStyle: this.editorCursorStyle,
      editorCursorWidth: this.editorCursorWidth,
      editorCursorBlinking: this.editorCursorBlinking,
      editorCursorSmoothCaret: this.editorCursorSmoothCaret,
      editorCaretExtraTop: this.editorCaretExtraTop,
      editorCaretExtraBottom: this.editorCaretExtraBottom,
      currentLineBlame: this.currentLineBlame,
      blameGutter: this.blameGutter,
      mouseWheelZoom: this.mouseWheelZoom,
      checkForUpdates: this.checkForUpdates,
      updateChannel: this.updateChannel,
      ignoreWhitespace: this.ignoreWhitespace,
      logAllRefs: this.logAllRefs,
      updateMethod: this.updateMethod,
      commitSignOff: this.commitSignOff,
      commitGpgSign: this.commitGpgSign,
      gitConsole: this.gitConsole,
      terminalShell: this.terminalShell,
      terminalFontFamily: this.terminalFontFamily,
      terminalFontSize: this.terminalFontSize,
      terminalLineHeight: this.terminalLineHeight,
      terminalLetterSpacing: this.terminalLetterSpacing,
      terminalFontWeight: this.terminalFontWeight,
      terminalFontWeightBold: this.terminalFontWeightBold,
      terminalLigatures: this.terminalLigatures,
      terminalNerdFontIcons: this.terminalNerdFontIcons,
      terminalCursorStyle: this.terminalCursorStyle,
      terminalCursorBlink: this.terminalCursorBlink,
      terminalScrollback: this.terminalScrollback,
      terminalCopyOnSelect: this.terminalCopyOnSelect,
      markdownViewMode: this.markdownViewMode,
      confirmDragAndDrop: this.confirmDragAndDrop,
      mcpEnabled: this.mcpEnabled,
      cliEnabled: this.cliEnabled,
      memoryLogEnabled: this.memoryLogEnabled,
      memoryLogIntervalMs: this.memoryLogIntervalMs,
      memoryLogThresholdMb: this.memoryLogThresholdMb,
      mcpPort: this.mcpPort,
      mcpTools: this.mcpTools,
    };
  }

  /** Preference keys whose value differs from the default, in display order. */
  changedPreferences(): (keyof Preferences)[] {
    return changedPreferenceKeys(this.preferences());
  }

  private uiState(): UiState {
    return {
      recentRepos: this.recentRepos,
      recentWorkspaces: this.recentWorkspaces,
      lastSession: this.lastSession,
      lastSessionFile: this.lastSessionFile,
      sessionRecorded: this.sessionRecorded,
      recentWorkspaceFiles: this.recentWorkspaceFiles,
      lastRunVersion: this.lastRunVersion,
      skippedVersion: this.skippedVersion,
      activeRepos: this.activeRepos,
      scriptNodeVersions: this.scriptNodeVersions,
      explorerOpen: this.explorerOpen,
      leftBarVisible: this.leftBarVisible,
      rightBarVisible: this.rightBarVisible,
      diffSplitRatio: this.diffSplitRatio,
      leftPanel: this.leftPanel,
      sidebarWidth: this.sidebarWidth,
      explorerWidth: this.explorerWidth,
      terminalHeight: this.terminalHeight,
      terminalListWidth: this.terminalListWidth,
      markdownPreviewRatio: this.markdownPreviewRatio,
    };
  }

  /** Schedules a write of both files; rapid changes coalesce into one write. */
  save(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), SAVE_DELAY_MS);
  }

  private flush(): void {
    clearTimeout(this.saveTimer);
    const writes = writableConfigs(this.loadErrors).map((configName) =>
      configName === "state"
        ? api.saveConfig("state", stateToJson(this.uiState(), this.extraState))
        : api.saveConfig("settings", { ...this.extraPreferences, ...this.preferences() }),
    );
    Promise.all(writes)
      .then(() => {
        this.saveFailed = false;
      })
      .catch((error) => {
        if (!this.saveFailed) {
          this.saveFailed = true;
          toast.error("Could not save settings", errorMessage(error));
        }
      });
  }

  /** Opens the Settings dialog on `section`. */
  openDialog(section: SettingsSection = "appearance"): void {
    this.dialogSection = section;
    this.dialogOpen = true;
  }

  /** Updates one preference and applies it right away. */
  setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
    (this as unknown as Preferences)[key] = value;
    this.applyAppearance();
    this.save();
  }

  /** View > Word Wrap and Option+Z, like VS Code; open file editors follow at once. */
  toggleWordWrap(): void {
    this.setPreference("wordWrap", !this.wordWrap);
  }

  resetPreferences(): void {
    this.applyPreferences({});
    this.loadError = null;
    this.applyAppearance();
    this.save();
  }

  /** Reads settings.json again, e.g. after the user fixed it by hand. */
  async reload(): Promise<void> {
    this.loadError = null;
    try {
      this.applyPreferences(await api.loadConfig("settings"));
      this.applyAppearance();
    } catch (error) {
      this.loadError = errorMessage(error);
    }
  }

  /** Reads state.json again after the user fixed it by hand. */
  async reloadState(): Promise<void> {
    try {
      this.applyState(await api.loadConfig("state"));
      this.stateLoadError = null;
    } catch (error) {
      this.stateLoadError = errorMessage(error);
    }
  }

  /** Replaces a state.json that could not be read with what this session knows. */
  resetState(): void {
    this.stateLoadError = null;
    this.extraState = {};
    this.flush();
  }

  /** The Node version a package.json's scripts run with; null goes back to Auto. */
  setScriptNodeVersion(filePath: string, choice: string | null): void {
    const { [filePath]: _previous, ...rest } = this.scriptNodeVersions;
    const next = choice === null ? rest : { ...rest, [filePath]: choice };
    this.scriptNodeVersions = Object.fromEntries(Object.entries(next).slice(-MAX_SCRIPT_NODE_VERSIONS));
    this.save();
  }

  rememberActiveRepo(workspaceRoot: string, repoRoot: string): void {
    this.activeRepos = { ...this.activeRepos, [workspaceRoot]: repoRoot };
    this.save();
  }

  setLeftPanel(panel: LeftPanel): void {
    this.leftPanel = panel;
    this.save();
  }

  /** Activity bar click: show the panel, or hide the sidebar when it is already shown. */
  toggleLeftPanel(panel: Exclude<LeftPanel, null>): void {
    this.setLeftPanel(this.leftPanel === panel ? null : panel);
  }

  /** Share of the editor area the Markdown preview takes, clamped; saved with state.json. */
  setMarkdownPreviewRatio(ratio: number, persist: boolean): void {
    const [min, max] = MARKDOWN_PREVIEW_RATIO_RANGE;
    this.markdownPreviewRatio = Number.isFinite(ratio) ? Math.min(max, Math.max(min, ratio)) : this.markdownPreviewRatio;
    if (persist) {
      this.save();
    }
  }

  toggleExplorer(): void {
    this.explorerOpen = !this.explorerOpen;
    this.save();
  }

  /** Shows or hides the icon strip at the left or right edge of the window. */
  toggleActivityBar(side: "left" | "right"): void {
    if (side === "left") {
      this.leftBarVisible = !this.leftBarVisible;
    } else {
      this.rightBarVisible = !this.rightBarVisible;
    }
    this.save();
  }

  addRecent(repoPath: string): void {
    this.recentRepos = [repoPath, ...this.recentRepos.filter((path) => path !== repoPath)].slice(0, MAX_RECENT);
    this.save();
  }

  /**
   * Remembers the open folders: reopened on start, and listed as a recent
   * workspace when there are several. An empty list (Close Folder) makes the
   * next start show the welcome screen.
   */
  rememberSession(folderRoots: string[], workspaceFile: string | null = null): void {
    this.lastSession = folderRoots;
    this.lastSessionFile = workspaceFile;
    this.sessionRecorded = true;
    if (workspaceFile) {
      this.recentWorkspaceFiles = [workspaceFile, ...this.recentWorkspaceFiles.filter((file) => file !== workspaceFile)].slice(
        0,
        MAX_RECENT,
      );
    } else if (folderRoots.length > 1) {
      const key = folderRoots.join("\n");
      this.recentWorkspaces = [folderRoots, ...this.recentWorkspaces.filter((folders) => folders.join("\n") !== key)].slice(
        0,
        MAX_RECENT,
      );
    }
    this.save();
  }

  removeRecentWorkspaceFile(workspaceFile: string): void {
    this.recentWorkspaceFiles = this.recentWorkspaceFiles.filter((file) => file !== workspaceFile);
    this.save();
  }

  removeRecentWorkspace(folderRoots: string[]): void {
    const key = folderRoots.join("\n");
    this.recentWorkspaces = this.recentWorkspaces.filter((folders) => folders.join("\n") !== key);
    this.save();
  }

  removeRecent(repoPath: string): void {
    this.recentRepos = this.recentRepos.filter((path) => path !== repoPath);
    this.save();
  }

  /** File > Open Recent > Clear Recent: forgets every recent folder, workspace and workspace file. */
  clearRecent(): void {
    this.recentRepos = [];
    this.recentWorkspaces = [];
    this.recentWorkspaceFiles = [];
    this.save();
  }

  setTheme(theme: ThemeSetting): void {
    this.setPreference("theme", theme);
  }

  /** Picks the color theme used in light or dark mode; it applies at once when that mode is in use. */
  setColorTheme(mode: ColorMode, themeId: string): void {
    this.setPreference(mode === "dark" ? "darkColorTheme" : "lightColorTheme", pickThemeId(themeId, mode));
  }

  /** Light or dark, after following macOS for "system". */
  get colorMode(): ColorMode {
    return effectiveMode(this.theme, this.systemDark);
  }

  applyTheme(): void {
    this.applyAppearance();
  }

  private watchSystemAppearance(): void {
    if (this.systemMedia) {
      return;
    }
    this.systemMedia = window.matchMedia("(prefers-color-scheme: dark)");
    this.systemDark = this.systemMedia.matches;
    this.systemMedia.addEventListener("change", (event) => {
      this.systemDark = event.matches;
      this.applyAppearance();
    });
  }

  /** Pushes theme and font sizes into the document. */
  applyAppearance(): void {
    const root = document.documentElement;
    this.watchSystemAppearance();
    // data-theme is always set, also when following macOS, so code that branches on light or
    // dark reads one attribute; the color theme's variables go in before the attributes change.
    const mode = this.colorMode;
    void applyColorTheme(mode, mode === "dark" ? this.darkColorTheme : this.lightColorTheme);
    root.style.setProperty("--ui-size", `${this.uiFontSize}px`);
    root.style.setProperty("--code-size", `${this.editorFontSize}px`);
    root.style.setProperty("--code-line-height", String(this.editorLineHeight));
    root.style.setProperty("--font-mono", this.editorFontFamily);
    root.setAttribute("data-ligatures", this.fontLigatures ? "on" : "off");
  }
}

export const settings = new SettingsStore();
