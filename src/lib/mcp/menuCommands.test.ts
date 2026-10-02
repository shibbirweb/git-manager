import { describe, expect, it } from "vitest";
import { MENU_ACTIONS } from "$lib/menu/menuIds";
import { menuSpec } from "$lib/menu/menuSpec";
import { type MenuInputs, menuState } from "$lib/menu/menuState";
import { menuCommands } from "./menuCommands";

const inputs: MenuInputs = {
  mode: "app",
  workspace: { folderCount: 1 },
  repo: {
    busy: false,
    ahead: 2,
    behind: 0,
    branch: "main",
    unborn: false,
    op: "none",
    conflicts: 0,
    changes: 1,
    remotes: 1,
    github: false,
  },
  gitFile: null,
  blameGutter: false,
  shownView: "log",
  activeFile: null,
  dirtyCount: 0,
  tabCount: 0,
  leftPanel: "changes",
  explorerOpen: true,
  leftBarVisible: true,
  rightBarVisible: true,
  terminalOpen: false,
  theme: "dark",
  wordWrap: false,
  editor: { focused: false, inText: false, writable: false },
  hasRecent: true,
};

describe("menuCommands", () => {
  const commands = menuCommands(menuSpec("macos", "app"), menuState(inputs));
  const byAction = new Map(commands.map((command) => [command.action, command]));

  it("lists every action of the main window once", () => {
    expect(commands.map((command) => command.action).sort()).toEqual([...MENU_ACTIONS].sort());
  });

  it("names where each item is and what it reads now", () => {
    expect(byAction.get("git.file.commit")?.menuPath).toBe("Git > Current File");
    expect(byAction.get("file.clearRecent")?.menuPath).toBe("File > Open Recent");
    expect(byAction.get("git.push")?.label).toBe("Push (2 ahead)...");
    expect(byAction.get("file.save")?.accelerator).toBe("CmdOrCtrl+S");
    expect(byAction.get("help.mcpTools")?.menuPath).toBe("Help");
  });

  it("gives the enabled, checked and shown state", () => {
    expect(byAction.get("file.save")?.enabled).toBe(false);
    expect(byAction.get("git.fetch")?.enabled).toBe(true);
    expect(byAction.get("view.themeDark")?.checked).toBe(true);
    expect(byAction.get("view.themeLight")?.checked).toBe(false);
    expect(byAction.get("git.fetch")).not.toHaveProperty("checked");
    expect(byAction.get("git.skipCommit")?.visible).toBe(false);
    expect(byAction.get("help.docs")?.enabled).toBe(true);
  });

  it("marks the commands that act on the focused editor", () => {
    expect(byAction.get("code.lineComment")?.editorCommand).toBe(true);
    expect(byAction.get("git.fetch")?.editorCommand).toBe(false);
  });

  it("lists only the mergetool window's items there", () => {
    const merge = menuCommands(menuSpec("macos", "mergeTool"), menuState({ ...inputs, mode: "mergeTool" }));
    expect(merge.some((command) => command.action === "git.fetch")).toBe(false);
    expect(merge.some((command) => command.action === "edit.find")).toBe(true);
  });
});
