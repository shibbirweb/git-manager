// The Scripts tool window's pure logic: the command each script runs and the rows of its tree.

import type { ProjectScript, ScriptKind, ScriptSource } from "$lib/types";

/** Package managers that can run package.json scripts (Run With in the menu). */
export const NODE_RUNNERS = ["npm", "yarn", "pnpm", "bun"] as const;

const SAFE_ARG = /^[\w@%+=:,./-]+$/;

/** Quotes one argument for a POSIX shell when it needs it. */
export function shellQuote(arg: string): string {
  if (arg !== "" && SAFE_ARG.test(arg)) {
    return arg;
  }
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

/** The program and arguments that run `scriptName` with `runner`, started without a shell. */
export function scriptArgs(kind: ScriptKind, runner: string, scriptName: string): { program: string; args: string[] } {
  switch (kind) {
    case "npm":
      return { program: runner, args: ["run", scriptName] };
    case "composer":
      return { program: "composer", args: ["run-script", scriptName] };
    case "make":
      return { program: "make", args: [scriptName] };
    case "deno":
      return { program: "deno", args: ["task", scriptName] };
    case "just":
      return { program: "just", args: [scriptName] };
  }
}

/** The same as one command line, for the tooltip and Copy Command. */
export function scriptCommand(kind: ScriptKind, runner: string, scriptName: string): string {
  const { program, args } = scriptArgs(kind, runner, scriptName);
  return [program, ...args].map(shellQuote).join(" ");
}

/** File name of a path, with either separator. */
function baseName(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] ?? filePath;
}

/** The folder of `source` relative to its workspace folder, "" at the top. */
export function relativeFolder(source: ScriptSource): string {
  const root = source.workspaceFolder.replace(/[\\/]+$/, "");
  const folder = source.folderPath.replace(/[\\/]+$/, "");
  if (folder === root) {
    return "";
  }
  return folder.startsWith(`${root}/`) || folder.startsWith(`${root}\\`) ? folder.slice(root.length + 1) : folder;
}

export interface SourceLabel {
  /** The file name, e.g. package.json. */
  title: string;
  /** Package name and folder, dimmed after the title. */
  detail: string;
}

export function sourceLabel(source: ScriptSource, severalFolders: boolean): SourceLabel {
  const folder = relativeFolder(source);
  const workspaceName = severalFolders ? baseName(source.workspaceFolder.replace(/[\\/]+$/, "")) : "";
  const location = [workspaceName, folder].filter(Boolean).join("/");
  return { title: baseName(source.filePath), detail: [source.packageName ?? "", location].filter(Boolean).join("  ") };
}

export type ScriptRow =
  | { kind: "source"; key: string; source: ScriptSource; expanded: boolean; matches: number }
  | { kind: "script"; key: string; source: ScriptSource; script: ProjectScript; parentKey: string };

function matchesFilter(script: ProjectScript, words: string[]): boolean {
  const haystack = `${script.name} ${script.command}`.toLowerCase();
  return words.every((word) => haystack.includes(word));
}

/**
 * The visible rows: each file, then its scripts while it is expanded. A filter keeps
 * the scripts whose name or command contains every word and shows their files open.
 */
export function scriptRows(sources: ScriptSource[], filter: string, isCollapsed: (filePath: string) => boolean): ScriptRow[] {
  const words = filter.toLowerCase().split(/\s+/).filter(Boolean);
  const rows: ScriptRow[] = [];
  for (const source of sources) {
    const scripts = words.length > 0 ? source.scripts.filter((script) => matchesFilter(script, words)) : source.scripts;
    if (words.length > 0 && scripts.length === 0) {
      continue;
    }
    const key = `source:${source.filePath}`;
    const expanded = words.length > 0 || !isCollapsed(source.filePath);
    rows.push({ kind: "source", key, source, expanded, matches: scripts.length });
    if (!expanded) {
      continue;
    }
    for (const script of scripts) {
      rows.push({ kind: "script", key: `script:${source.filePath}:${script.name}`, source, script, parentKey: key });
    }
  }
  return rows;
}

/** Name of a script's Run tab, e.g. "dev (pnpm)". */
export function terminalName(source: ScriptSource, scriptName: string): string {
  return `${scriptName} (${source.runner})`;
}
