// More than one window: what a window's page opens when it starts, read from the backend's
// answer (src-tauri/src/windows.rs `WindowStart`) and checked, so a bad answer only means
// the usual start. Pure, so it is tested.

/** What a window shows: folders, or a workspace file. No folders and no file: the welcome screen. */
export interface WindowOpen {
  folderPaths: string[];
  workspaceFile: string | null;
}

export type WindowStart = { kind: "open"; label: string; open: WindowOpen } | { kind: "default"; label: string };

export type StartStep =
  | { kind: "welcome" }
  | { kind: "folders"; folderPaths: string[] }
  | { kind: "workspaceFile"; filePath: string }
  /** The folder or workspace file from the command line. */
  | { kind: "launch"; path: string }
  /** What was open at quit (lastSession in state.json), as before there were several windows. */
  | { kind: "session" };

export const MAIN_WINDOW = "main";

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "") : [];
}

/** Reads the backend's answer; anything malformed is the main window's usual start. */
export function parseWindowStart(value: unknown): WindowStart {
  const data = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const label = typeof data.label === "string" && data.label ? data.label : MAIN_WINDOW;
  if (data.kind !== "open") {
    return { kind: "default", label };
  }
  const open = typeof data.open === "object" && data.open !== null ? (data.open as Record<string, unknown>) : {};
  const workspaceFile = typeof open.workspaceFile === "string" && open.workspaceFile.trim() ? open.workspaceFile : null;
  return { kind: "open", label, open: { folderPaths: strings(open.folderPaths), workspaceFile } };
}

/** What the page opens: the window's own folders, else the command line, else the last session. */
export function startStep(start: WindowStart, launchPath: string | null): StartStep {
  if (start.kind === "open") {
    if (start.open.workspaceFile) {
      return { kind: "workspaceFile", filePath: start.open.workspaceFile };
    }
    return start.open.folderPaths.length > 0 ? { kind: "folders", folderPaths: start.open.folderPaths } : { kind: "welcome" };
  }
  return launchPath ? { kind: "launch", path: launchPath } : { kind: "session" };
}

/** The title of a window, which macOS lists in the Window menu: the workspace name, else the app's. */
export function windowTitle(workspaceName: string | null): string {
  const name = workspaceName?.trim() ?? "";
  return name || "Git Manager";
}
