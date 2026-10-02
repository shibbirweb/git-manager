import { describe, expect, it } from "vitest";
import type { ShellProfile } from "$lib/types";
import {
  activeAfterClose,
  clampPanelHeight,
  maxListWidth,
  MIN_TERMINAL_VIEW_WIDTH,
  exitMessage,
  FALLBACK_SHELL_NAME,
  folderLabel,
  MAX_TERMINAL_NAME,
  resolveShellId,
  shellNameFor,
  startFolder,
  startupFailureTitle,
  startupLabel,
  uniqueTerminalName,
  validateTerminalName,
} from "./terminals";

function shell(id: string, name: string, isDefault = false): ShellProfile {
  return { id, name, path: id, args: [], isDefault };
}

const shells = [shell("/bin/zsh", "zsh", true), shell("/bin/bash", "bash"), shell("/opt/homebrew/bin/fish", "fish")];

describe("uniqueTerminalName", () => {
  it("numbers repeated shells like VS Code", () => {
    expect(uniqueTerminalName("zsh", [])).toBe("zsh");
    expect(uniqueTerminalName("zsh", ["zsh"])).toBe("zsh (2)");
    expect(uniqueTerminalName("zsh", ["zsh", "zsh (2)"])).toBe("zsh (3)");
    expect(uniqueTerminalName("bash", ["zsh", "zsh (2)"])).toBe("bash");
  });

  it("reuses freed numbers and the plain name", () => {
    expect(uniqueTerminalName("zsh", ["zsh", "zsh (3)"])).toBe("zsh (2)");
    expect(uniqueTerminalName("zsh", ["zsh (2)"])).toBe("zsh");
  });

  it("falls back for an empty shell name", () => {
    expect(uniqueTerminalName("  ", [])).toBe(FALLBACK_SHELL_NAME);
  });
});

describe("activeAfterClose", () => {
  it("keeps the active terminal when another one closes", () => {
    expect(activeAfterClose([1, 2, 3], 1, 3)).toBe(3);
  });

  it("moves to the right neighbour, else the left one", () => {
    expect(activeAfterClose([1, 2, 3], 2, 2)).toBe(3);
    expect(activeAfterClose([1, 2, 3], 3, 3)).toBe(2);
    expect(activeAfterClose([1, 2, 3], 1, 1)).toBe(2);
  });

  it("returns null after the last terminal", () => {
    expect(activeAfterClose([4], 4, 4)).toBeNull();
    expect(activeAfterClose([], 4, null)).toBeNull();
  });

  it("picks one when nothing was active", () => {
    expect(activeAfterClose([1, 2], 1, null)).toBe(2);
    expect(activeAfterClose([1, 2], 9, null)).toBe(1);
  });
});

describe("startFolder", () => {
  it("prefers the folder asked for, then the active repository, then the first folder", () => {
    const workspaceFolders = ["/work/a", "/work/b"];
    expect(startFolder({ requestedFolder: "/work/a/src", repoRoot: "/work/b", workspaceFolders })).toBe("/work/a/src");
    expect(startFolder({ requestedFolder: null, repoRoot: "/work/b", workspaceFolders })).toBe("/work/b");
    expect(startFolder({ repoRoot: null, workspaceFolders })).toBe("/work/a");
  });

  it("leaves the home folder to the backend when nothing is open", () => {
    expect(startFolder({})).toBeNull();
    expect(startFolder({ requestedFolder: "", repoRoot: "", workspaceFolders: [] })).toBeNull();
  });
});

describe("resolveShellId", () => {
  it("uses an explicit choice first", () => {
    expect(resolveShellId("/bin/bash", "/opt/homebrew/bin/fish", shells)).toBe("/bin/bash");
  });

  it("uses the default setting while that shell exists", () => {
    expect(resolveShellId(null, "/opt/homebrew/bin/fish", shells)).toBe("/opt/homebrew/bin/fish");
    expect(resolveShellId(null, "/usr/local/bin/nu", shells)).toBeNull();
    // An unknown list (it failed to load) trusts the setting.
    expect(resolveShellId(null, "/usr/local/bin/nu", [])).toBe("/usr/local/bin/nu");
  });

  it("means the login shell without a choice or setting", () => {
    expect(resolveShellId(null, null, shells)).toBeNull();
  });
});

describe("shellNameFor", () => {
  it("names the chosen shell or the login shell", () => {
    expect(shellNameFor("/bin/bash", shells)).toBe("bash");
    expect(shellNameFor(null, shells)).toBe("zsh");
  });

  it("falls back to the file name or a generic name", () => {
    expect(shellNameFor("/usr/local/bin/nu", shells)).toBe("nu");
    expect(shellNameFor(null, [])).toBe(FALLBACK_SHELL_NAME);
  });
});

describe("folderLabel", () => {
  it("shows the last part of the folder", () => {
    expect(folderLabel("/Users/me/git-merger")).toBe("git-merger");
    expect(folderLabel("/Users/me/git-merger/")).toBe("git-merger");
    expect(folderLabel("/")).toBe("/");
    expect(folderLabel(null)).toBe("~");
  });
});

describe("validateTerminalName", () => {
  it("needs a short, non-empty name", () => {
    expect(validateTerminalName("build")).toBeNull();
    expect(validateTerminalName("   ")).not.toBeNull();
    expect(validateTerminalName("x".repeat(MAX_TERMINAL_NAME + 1))).not.toBeNull();
  });
});

describe("exitMessage", () => {
  it("writes a dim line with the exit code", () => {
    expect(exitMessage(1)).toBe("\r\n\x1b[2m[Process exited with code 1]\x1b[0m\r\n");
    expect(exitMessage(null)).toContain("[Process exited]");
  });
});

describe("maxListWidth", () => {
  it("leaves the terminal its minimum width", () => {
    expect(maxListWidth(1000, 120)).toBe(1000 - MIN_TERMINAL_VIEW_WIDTH);
    expect(maxListWidth(300, 120)).toBe(120);
  });
});

describe("clampPanelHeight", () => {
  it("keeps the saved height between the minimum and what the editor can spare", () => {
    expect(clampPanelHeight(260, 80, 500)).toBe(260);
    expect(clampPanelHeight(900, 80, 500)).toBe(500);
    expect(clampPanelHeight(20, 80, 500)).toBe(80);
    // A tiny window still shows the minimum.
    expect(clampPanelHeight(260, 80, 40)).toBe(80);
  });
});

describe("startupLabel", () => {
  it("names the step a starting terminal is on", () => {
    expect(startupLabel("loading", "zsh")).toBe("Loading terminal...");
    expect(startupLabel("starting", "zsh")).toBe("Starting zsh...");
    expect(startupLabel("starting", "  ")).toBe(`Starting ${FALLBACK_SHELL_NAME}...`);
  });

  it("shows nothing once the shell runs or failed", () => {
    expect(startupLabel("ready", "zsh")).toBeNull();
    expect(startupLabel("failed", "zsh")).toBeNull();
  });
});

describe("startupFailureTitle", () => {
  it("tells a shell that failed from xterm that did not load", () => {
    expect(startupFailureTitle(true, "fish")).toBe("Could not start fish");
    expect(startupFailureTitle(true, "")).toBe(`Could not start ${FALLBACK_SHELL_NAME}`);
    expect(startupFailureTitle(false, "fish")).toBe("Could not load the terminal");
  });
});
