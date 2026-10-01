import { describe, expect, it } from "vitest";
import {
  DEFAULT_PANEL_WIDTH,
  defaultPreferences,
  parsePreferences,
  parseState,
  sessionSteps,
  shouldMigrateLegacy,
  stateToJson,
  writableConfigs,
} from "./settingsData";

const noErrors = { settings: null, state: null };

describe("parsePreferences", () => {
  it("falls back to defaults for missing or invalid values", () => {
    expect(parsePreferences(null).preferences).toEqual(defaultPreferences);
    const { preferences } = parsePreferences({ theme: "neon", tabSize: 3, uiFontSize: 99, wordWrap: "yes", updateChannel: "beta" });
    expect(preferences.theme).toBe("system");
    expect(preferences.tabSize).toBe(4);
    expect(preferences.uiFontSize).toBe(16);
    expect(preferences.wordWrap).toBe(false);
    expect(preferences.updateChannel).toBe("beta");
  });

  it("keeps unknown keys but drops state keys mixed in by legacy storage", () => {
    const { extra } = parsePreferences({ theme: "dark", futureOption: 1, recentRepos: ["/a"], sidebarWidth: 300 });
    expect(extra).toEqual({ futureOption: 1 });
  });
});

describe("parseState", () => {
  it("validates every value and keeps unknown keys", () => {
    const { state, extra } = parseState({
      recentFolders: ["/a", 3, "/b"],
      recentWorkspaces: [["/a", "/b"], ["/single"], "bad"],
      lastSession: ["/a"],
      lastSessionFile: 7,
      activeRepos: { "/a": "/a/web", "/b": false },
      leftPanel: "nope",
      sidebarWidth: 10,
      somethingNew: true,
    });
    expect(state.recentRepos).toEqual(["/a", "/b"]);
    expect(state.recentWorkspaces).toEqual([["/a", "/b"]]);
    expect(state.lastSessionFile).toBeNull();
    expect(state.activeRepos).toEqual({ "/a": "/a/web" });
    expect(state.leftPanel).toBe("changes");
    expect(state.sidebarWidth).toBe(120);
    expect(state.explorerWidth).toBe(DEFAULT_PANEL_WIDTH);
    expect(extra).toEqual({ somethingNew: true });
  });

  it("reads the old recentRepos name", () => {
    expect(parseState({ recentRepos: ["/old"] }).state.recentRepos).toEqual(["/old"]);
  });

  it("notes whether a session was recorded, even an empty one", () => {
    expect(parseState({}).state.sessionRecorded).toBe(false);
    expect(parseState({ lastSession: [] }).state.sessionRecorded).toBe(true);
  });

  it("round-trips through stateToJson", () => {
    const { state, extra } = parseState({ recentFolders: ["/a"], lastSession: [], somethingNew: 1 });
    const json = stateToJson(state, extra);
    expect(json.somethingNew).toBe(1);
    expect(json.lastSession).toEqual([]);
    expect(json).not.toHaveProperty("sessionRecorded");
    expect(parseState(json).state).toEqual(state);
  });
});

describe("writableConfigs", () => {
  it("writes both files when both loaded", () => {
    expect(writableConfigs(noErrors)).toEqual(["state", "settings"]);
  });

  it("never overwrites a file that failed to parse", () => {
    expect(writableConfigs({ settings: "bad json", state: null })).toEqual(["state"]);
    expect(writableConfigs({ settings: null, state: "bad json" })).toEqual(["settings"]);
    expect(writableConfigs({ settings: "bad", state: "bad" })).toEqual([]);
  });
});

describe("shouldMigrateLegacy", () => {
  it("migrates only on a first run without errors", () => {
    expect(shouldMigrateLegacy({ settings: null, state: null }, noErrors)).toBe(true);
    expect(shouldMigrateLegacy({ settings: {}, state: null }, noErrors)).toBe(false);
    // A broken state.json must not be mistaken for a first run.
    expect(shouldMigrateLegacy({ settings: null, state: null }, { settings: null, state: "bad" })).toBe(false);
  });
});

describe("sessionSteps", () => {
  const base = { lastSession: [], lastSessionFile: null, sessionRecorded: true, recentRepos: ["/recent"] };

  it("reopens the workspace file first, then its folders", () => {
    expect(sessionSteps({ ...base, lastSessionFile: "/w.gitmanager-workspace", lastSession: ["/a", "/b"] })).toEqual([
      { kind: "workspaceFile", filePath: "/w.gitmanager-workspace" },
      { kind: "folders", folderPaths: ["/a", "/b"] },
    ]);
  });

  it("restores the folders open at quit", () => {
    expect(sessionSteps({ ...base, lastSession: ["/a"] })).toEqual([{ kind: "folders", folderPaths: ["/a"] }]);
  });

  it("shows the welcome screen after Close Folder", () => {
    expect(sessionSteps(base)).toEqual([]);
  });

  it("falls back to the most recent folder only for state without a session", () => {
    expect(sessionSteps({ ...base, sessionRecorded: false })).toEqual([{ kind: "folders", folderPaths: ["/recent"] }]);
    expect(sessionSteps({ ...base, sessionRecorded: false, recentRepos: [] })).toEqual([]);
  });
});
