import { describe, expect, it } from "vitest";
import { MENU_ACTIONS } from "$lib/menu/menuIds";
import { type GitRepoInputs, type MenuInputs, menuState } from "$lib/menu/menuState";
import { menuSpec } from "$lib/menu/menuSpec";
import {
  APP_COMMANDS,
  buildCommandSpecs,
  commandForKey,
  commandTitle,
  type CommandView,
  commandViews,
  disabledReason,
  effectiveShortcut,
  menuAccelerators,
  paletteList,
} from "./registry";

const repo: GitRepoInputs = {
  busy: false,
  ahead: 2,
  behind: 0,
  branch: "main",
  unborn: false,
  op: "none",
  conflicts: 0,
  changes: 2,
  remotes: 1,
  github: false,
  bisecting: false,
  remoteLinks: 0,
};

const idle: MenuInputs = {
  mode: "app",
  workspace: { folderCount: 1 },
  repo,
  gitFile: null,
  blameGutter: false,
  shownView: "file",
  activeFile: { dirty: false, editable: true, markdownMode: null },
  dirtyCount: 0,
  tabCount: 1,
  leftPanel: "changes",
  explorerOpen: false,
  leftBarVisible: true,
  rightBarVisible: true,
  terminalOpen: false,
  theme: "system",
  wordWrap: true,
  editor: { focused: false, inText: false, writable: false },
  hasRecent: true,
};

const specs = buildCommandSpecs(menuSpec("macos", "app"));

function views(inputs: MenuInputs): CommandView[] {
  return commandViews(specs, menuState(inputs), inputs);
}

function view(inputs: MenuInputs, commandId: string): CommandView | undefined {
  return views(inputs).find((candidate) => candidate.spec.id === commandId);
}

describe("buildCommandSpecs", () => {
  it("makes every menu item a command, once, plus the app commands", () => {
    const ids = specs.map((spec) => spec.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const action of MENU_ACTIONS) {
      expect(ids).toContain(action);
    }
    for (const extra of APP_COMMANDS) {
      expect(ids).toContain(extra.id);
    }
  });

  it("takes titles, categories and keys from the menu", () => {
    const byId = new Map(specs.map((spec) => [spec.id, spec]));
    expect(byId.get("git.commit")).toMatchObject({ title: "Commit", category: "Git", defaultShortcut: "Cmd+K", scope: "global" });
    expect(byId.get("git.file.history")).toMatchObject({ title: "Show History", category: "Git > Current File" });
    expect(byId.get("file.clearRecent")).toMatchObject({ category: "File > Open Recent" });
    expect(byId.get("app.settings")).toMatchObject({ title: "Settings", category: "App", defaultShortcut: "CmdOrCtrl+," });
    expect(byId.get("view.commandPalette")).toMatchObject({ defaultShortcut: "CmdOrCtrl+Shift+P", inPalette: false });
    expect(byId.get("edit.goToFile")).toMatchObject({ defaultShortcut: "CmdOrCtrl+P", inPalette: true });
    expect(byId.get("edit.recentFiles")).toMatchObject({ title: "Recent Files", defaultShortcut: "CmdOrCtrl+E", inPalette: true });
    expect(byId.get("code.lineComment")).toMatchObject({ scope: "editor", defaultShortcut: "CmdOrCtrl+/" });
    expect(byId.get("view.sidebar")?.checkable).toBe(true);
    expect(byId.get("nav.goBack")).toMatchObject({ menuAction: null, defaultShortcut: "Ctrl+-", needsWorkspace: true });
  });

  it("puts the app menu items under File elsewhere", () => {
    const linux = buildCommandSpecs(menuSpec("linux", "app"));
    expect(linux.find((spec) => spec.id === "app.settings")?.category).toBe("File");
    expect(linux.filter((spec) => spec.id === "app.settings")).toHaveLength(1);
  });

  it("drops the trailing dots of menu titles", () => {
    expect(commandTitle("Push...")).toBe("Push");
    expect(commandTitle("Log")).toBe("Log");
  });
});

describe("shortcuts", () => {
  it("lets overrides replace or remove a default", () => {
    const palette = specs.find((spec) => spec.id === "view.commandPalette");
    expect(palette).toBeDefined();
    if (palette) {
      expect(effectiveShortcut(palette)).toBe("CmdOrCtrl+Shift+P");
      expect(effectiveShortcut(palette, { "view.commandPalette": "CmdOrCtrl+Alt+P" })).toBe("CmdOrCtrl+Alt+P");
      expect(effectiveShortcut(palette, { "view.commandPalette": null })).toBeNull();
    }
  });

  it("finds the command of a key press", () => {
    const press = { key: "P", code: "KeyP", metaKey: true, ctrlKey: false, altKey: false, shiftKey: true };
    expect(commandForKey(specs, press, "macos")?.id).toBe("view.commandPalette");
    expect(commandForKey(specs, { ...press, shiftKey: false, key: "p" }, "macos")?.id).toBe("edit.goToFile");
    expect(commandForKey(specs, press, "macos", { "view.commandPalette": null })).toBeNull();
    expect(commandForKey(specs, { ...press, key: "j", code: "KeyJ" }, "macos", { "git.push": "CmdOrCtrl+Shift+J" })?.id).toBe("git.push");
  });
});

describe("commandViews", () => {
  it("shows the menu's state: enabled, checked and renamed", () => {
    expect(view(idle, "git.push")).toMatchObject({ title: "Push (2 ahead)", enabled: true, reason: null });
    expect(view(idle, "view.wordWrap")?.checked).toBe(true);
    expect(view(idle, "git.commit")?.checked).toBeNull();
    expect(view({ ...idle, workspace: { folderCount: 2 } }, "file.closeFolder")?.title).toBe("Close Workspace");
  });

  it("leaves out what the menu hides", () => {
    expect(view(idle, "git.continueOp")).toBeUndefined();
    expect(view({ ...idle, repo: { ...repo, op: "merge" } }, "git.continueOp")?.title).toBe("Continue Merge");
  });

  it("disables with a reason", () => {
    expect(view(idle, "code.lineComment")).toMatchObject({ enabled: false, reason: "Needs a text editor" });
    const editing = { ...idle, editor: { focused: true, inText: true, writable: true } };
    expect(view(editing, "code.lineComment")).toMatchObject({ enabled: true, reason: null });
    expect(view({ ...idle, editor: { focused: true, inText: true, writable: false } }, "code.lineComment")?.reason).toBe(
      "The editor is read-only",
    );
    const noFolder = { ...idle, workspace: null, repo: null, activeFile: null };
    expect(view(noFolder, "git.commit")?.reason).toBe("Open a folder first");
    expect(view(noFolder, "nav.goBack")).toMatchObject({ enabled: false, reason: "Open a folder first" });
    expect(view(noFolder, "app.settings")?.enabled).toBe(true);
    expect(view({ ...idle, repo: null }, "git.commit")?.reason).toBe("Needs a Git repository");
    expect(view({ ...idle, repo: { ...repo, busy: true } }, "git.commit")?.reason).toBe("Git is busy");
    expect(view(idle, "file.save")?.reason).toBe("No unsaved changes");
  });

  it("explains a reason for each disabled command", () => {
    const spec = specs.find((candidate) => candidate.id === "git.file.history");
    expect(spec && disabledReason(spec, idle)).toBe("Needs a file from the repository");
  });

  it("explains why the line actions wait for a diff", () => {
    expect(view(idle, "git.lines.stage")?.reason).toBe("Needs a diff from Changes");
    const staged = { ...idle, shownView: "diff" as const, diffLines: "staged" as const };
    expect(view(staged, "git.lines.stage")?.reason).toBe("Needs an unstaged diff");
    expect(view(staged, "git.lines.unstage")).toMatchObject({ enabled: true, reason: null });
    expect(view({ ...staged, diffLines: "unstaged" as const }, "git.lines.unstage")?.reason).toBe("Needs a staged diff");
  });
});

describe("paletteList", () => {
  it("lists recently used commands first, then the others enabled first and alphabetically", () => {
    const list = paletteList(views(idle), "", ["git.pull", "git.push", "unknown.command"], "macos");
    expect(list.recent.map((item) => item.commandId)).toEqual(["git.pull", "git.push"]);
    expect(list.other.some((item) => item.commandId === "git.push")).toBe(false);
    expect(list.other.some((item) => item.commandId === "view.commandPalette")).toBe(false);
    const firstDisabled = list.other.findIndex((item) => !item.enabled);
    expect(firstDisabled).toBeGreaterThan(0);
    expect(list.other.slice(firstDisabled).every((item) => !item.enabled)).toBe(true);
    const text = (parts: { text: string }[]) => parts.map((part) => part.text).join("");
    const enabledLabels = list.other.slice(0, firstDisabled).map((item) => `${text(item.categoryParts)}: ${text(item.titleParts)}`);
    expect(enabledLabels).toEqual([...enabledLabels].sort((a, b) => a.localeCompare(b)));
  });

  it("matches the category and title, with highlights and the shortcut written for the platform", () => {
    const list = paletteList(views(idle), "palette", [], "macos");
    expect(list.recent).toEqual([]);
    // The palette is not listed in itself.
    expect(list.other.some((item) => item.commandId === "view.commandPalette")).toBe(false);
    const push = paletteList(views(idle), "git push", [], "macos").other[0];
    expect(push.commandId).toBe("git.push");
    expect(push.categoryParts).toEqual([{ text: "Git", match: true }]);
    expect(push.titleParts[0]).toEqual({ text: "Push", match: true });
    const settings = paletteList(views(idle), "settings", [], "macos").other[0];
    expect(settings.commandId).toBe("app.settings");
    expect(settings.shortcut).toBe("⌘,");
  });

  it("puts enabled matches before disabled ones and lifts recent ones", () => {
    const matches = paletteList(views(idle), "comment", [], "macos").other;
    expect(matches.length).toBeGreaterThan(0);
    const firstDisabled = matches.findIndex((item) => !item.enabled);
    expect(matches.slice(firstDisabled).every((item) => !item.enabled)).toBe(true);
    expect(matches.find((item) => item.commandId === "code.lineComment")).toMatchObject({ enabled: false, reason: "Needs a text editor" });
    const plain = paletteList(views(idle), "fetch", [], "macos").other.map((item) => item.commandId);
    expect(plain[0]).toBe("git.fetchCurrent");
    const lifted = paletteList(views(idle), "fetch", ["git.fetch"], "macos").other.map((item) => item.commandId);
    expect(lifted[0]).toBe("git.fetch");
  });
});

describe("custom keys and the native menu", () => {
  it("shows each item's own accelerator without custom keys", () => {
    const accelerators = menuAccelerators(menuSpec("macos", "app"));
    expect(accelerators.get("view.commandPalette")).toBe("CmdOrCtrl+Shift+P");
    expect(accelerators.get("git.push")).toBeNull();
    // Shift+Cmd+G is Find Previous in the Edit menu; Changes keeps it off its item.
    expect(accelerators.get("view.changes")).toBeNull();
  });

  it("puts custom keys on the items and takes removed ones off", () => {
    const accelerators = menuAccelerators(menuSpec("macos", "app"), { "git.push": "F5", "view.commandPalette": null, "nav.goBack": "F6" });
    expect(accelerators.get("git.push")).toBe("F5");
    expect(accelerators.get("view.commandPalette")).toBeNull();
    // App commands have no menu item.
    expect(accelerators.has("nav.goBack" as never)).toBe(false);
  });

  it("gives Changes the window key the menu leaves off", () => {
    expect(specs.find((spec) => spec.id === "view.changes")?.defaultShortcut).toBe("CmdOrCtrl+Shift+G");
  });

  it("opens Keyboard Shortcuts from the palette as a Preferences command", () => {
    const command = specs.find((spec) => spec.id === "settings.keyboardShortcuts");
    expect(command?.category).toBe("Preferences");
    expect(command?.title).toBe("Open Keyboard Shortcuts");
    expect(command?.needsWorkspace).toBe(false);
    expect(command?.inPalette).toBe(true);
  });
});
