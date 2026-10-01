// User preferences and UI state, stored like VS Code in the home folder:
//   ~/.gitmanager/settings.json   preferences shown in the Settings dialog
//   ~/.gitmanager/state.json      recent folders, panel sizes and similar
// Values are validated on load so a hand-edited file can never break the app,
// and unknown keys are preserved on save. A file that fails to parse only
// affects itself and is never overwritten automatically. The pure parts live
// in settingsData.ts.

import { api, errorMessage } from "$lib/api";
import { toast } from "$lib/ui/toast.svelte";
import {
  asObject,
  type ConfigName,
  defaultPreferences,
  type Json,
  type LeftPanel,
  type LoadErrors,
  MAX_RECENT,
  parsePreferences,
  parseState,
  type Preferences,
  shouldMigrateLegacy,
  stateToJson,
  type ThemeSetting,
  type UiState,
  type UpdateChannelSetting,
  writableConfigs,
} from "./settingsData";

export {
  DEFAULT_EDITOR_FONT,
  DEFAULT_PANEL_WIDTH,
  defaultPreferences,
  FONT_SIZE_RANGE,
  MONOSPACE_FONTS,
  normalizeFontFamily,
  TAB_SIZES,
} from "./settingsData";
export type { LeftPanel, Preferences, ThemeSetting, UpdateChannelSetting } from "./settingsData";

/** Sections of the Settings dialog. */
export type SettingsSection = "appearance" | "editor" | "merge" | "layout" | "updates" | "files" | "about";

const SAVE_DELAY_MS = 200;
/** Where settings lived before ~/.gitmanager existed; migrated once. */
const LEGACY_STORAGE_KEY = "git-merger:settings";

const initialPreferences = parsePreferences({}).preferences;
const initialState = parseState({}).state;

class SettingsStore {
  // Preferences (settings.json)
  theme = $state<ThemeSetting>(initialPreferences.theme);
  uiFontSize = $state(initialPreferences.uiFontSize);
  editorFontSize = $state(initialPreferences.editorFontSize);
  editorFontFamily = $state(initialPreferences.editorFontFamily);
  fontLigatures = $state(initialPreferences.fontLigatures);
  tabSize = $state(initialPreferences.tabSize);
  wordWrap = $state(initialPreferences.wordWrap);
  currentLineBlame = $state(initialPreferences.currentLineBlame);
  blameGutter = $state(initialPreferences.blameGutter);
  mouseWheelZoom = $state(initialPreferences.mouseWheelZoom);
  checkForUpdates = $state(initialPreferences.checkForUpdates);
  updateChannel = $state<UpdateChannelSetting>(initialPreferences.updateChannel);
  ignoreWhitespace = $state(initialPreferences.ignoreWhitespace);
  logAllRefs = $state(initialPreferences.logAllRefs);

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
  explorerOpen = $state(initialState.explorerOpen);
  leftPanel = $state<LeftPanel>(initialState.leftPanel);
  sidebarWidth = $state(initialState.sidebarWidth);
  explorerWidth = $state(initialState.explorerWidth);

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
      uiFontSize: this.uiFontSize,
      editorFontSize: this.editorFontSize,
      editorFontFamily: this.editorFontFamily,
      fontLigatures: this.fontLigatures,
      tabSize: this.tabSize,
      wordWrap: this.wordWrap,
      currentLineBlame: this.currentLineBlame,
      blameGutter: this.blameGutter,
      mouseWheelZoom: this.mouseWheelZoom,
      checkForUpdates: this.checkForUpdates,
      updateChannel: this.updateChannel,
      ignoreWhitespace: this.ignoreWhitespace,
      logAllRefs: this.logAllRefs,
    };
  }

  /** Preference keys whose value differs from the default, in display order. */
  changedPreferences(): (keyof Preferences)[] {
    const current = this.preferences();
    return (Object.keys(defaultPreferences) as (keyof Preferences)[]).filter((key) => current[key] !== defaultPreferences[key]);
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
      explorerOpen: this.explorerOpen,
      leftPanel: this.leftPanel,
      sidebarWidth: this.sidebarWidth,
      explorerWidth: this.explorerWidth,
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

  toggleExplorer(): void {
    this.explorerOpen = !this.explorerOpen;
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

  setTheme(theme: ThemeSetting): void {
    this.setPreference("theme", theme);
  }

  applyTheme(): void {
    this.applyAppearance();
  }

  /** Pushes theme and font sizes into the document. */
  applyAppearance(): void {
    const root = document.documentElement;
    if (this.theme === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", this.theme);
    }
    root.style.setProperty("--ui-size", `${this.uiFontSize}px`);
    root.style.setProperty("--code-size", `${this.editorFontSize}px`);
    root.style.setProperty("--font-mono", this.editorFontFamily);
    root.setAttribute("data-ligatures", this.fontLigatures ? "on" : "off");
  }
}

export const settings = new SettingsStore();
