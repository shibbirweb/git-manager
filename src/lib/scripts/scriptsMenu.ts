// The Scripts panel's right-click menus: run, copy or jump to a script; open a file, pick its Node version or its
// runner; expand, collapse and refresh the list.
import { errorMessage } from "$lib/api";
import { navigation } from "$lib/stores/navigation.svelte";
import { settings } from "$lib/stores/settings.svelte";
import type { NodeInstall, ProjectScript, ScriptSource } from "$lib/types";
import type { MenuItem, MenuSubmenu } from "$lib/ui/menu.svelte";
import { toast } from "$lib/ui/toast.svelte";
import { pickNode, SHELL_DEFAULT } from "./nodeVersion";
import { runnerOverrides } from "./runnerOverrides.svelte";
import { nodePickFor } from "./scriptRun";
import { NODE_RUNNERS, type ScriptRow, scriptCommand } from "./scriptsModel";

/** What the menus need from the panel. */
export interface ScriptsMenuHost {
  /** The files as read, before any runner the user picked. */
  sources: ScriptSource[];
  nodeInstalls: NodeInstall[];
  run: (source: ScriptSource, script: ProjectScript) => void;
  expandAll: () => void;
  collapseAll: () => void;
  refresh: () => void;
}

/** Auto, the shell's default and each installed Node version, the one in use marked. */
export function nodeMenu(source: ScriptSource, nodeInstalls: NodeInstall[]): MenuSubmenu {
  const pick = nodePickFor(source, nodeInstalls, settings.scriptNodeVersions);
  const choice = settings.scriptNodeVersions[source.filePath] ?? null;
  const auto = pickNode(source.nodeVersion ?? null, nodeInstalls, null);
  const autoHint = auto.install
    ? `${auto.install.version}, ${auto.wanted?.source ?? ""}`
    : auto.missing
      ? `${auto.wanted?.spec} missing`
      : "shell default";
  const current = (value: string | null) =>
    value === choice || (value === null && pick?.mode === "auto") ? "in use" : undefined;
  const items: MenuItem[] = [
    {
      label: "Auto (Follow Project)",
      hint: current(null) ?? autoHint,
      action: () => settings.setScriptNodeVersion(source.filePath, null),
    },
    {
      label: "Shell Default",
      hint: current(SHELL_DEFAULT),
      action: () => settings.setScriptNodeVersion(source.filePath, SHELL_DEFAULT),
    },
  ];
  if (nodeInstalls.length > 0) {
    items.push({ separator: true });
  }
  for (const install of nodeInstalls) {
    items.push({
      label: `${install.version} (${install.manager})`,
      hint: current(install.binDir),
      action: () => settings.setScriptNodeVersion(source.filePath, install.binDir),
    });
  }
  return { label: "Node Version", submenu: items };
}

export function jumpToSource(source: ScriptSource, script: ProjectScript | null): void {
  const line = script && script.line > 0 ? script.line - 1 : null;
  void navigation.openFileAt(source.filePath, line, 0, { pin: true });
}

async function copyCommand(source: ScriptSource, script: ProjectScript): Promise<void> {
  try {
    await navigator.clipboard.writeText(scriptCommand(source.kind, source.runner, script.name));
    toast.success("Copied to clipboard");
  } catch (error) {
    toast.error("Could not copy", errorMessage(error));
  }
}

export function scriptsMenu(row: ScriptRow, host: ScriptsMenuHost): MenuItem[] {
  if (row.kind === "script") {
    return [
      { label: `Run '${row.script.name}'`, action: () => host.run(row.source, row.script) },
      { separator: true },
      { label: "Copy Command", action: () => void copyCommand(row.source, row.script) },
      { label: "Jump to Source", action: () => jumpToSource(row.source, row.script) },
    ];
  }
  const items: MenuItem[] = [{ label: "Open File", action: () => jumpToSource(row.source, null) }];
  if (row.source.kind === "npm") {
    items.push(nodeMenu(row.source, host.nodeInstalls));
    if (row.source.nodeVersion) {
      const wantedFile = row.source.nodeVersion.filePath;
      items.push({
        label: `Open ${row.source.nodeVersion.source.split(" ")[0]}`,
        action: () => void navigation.openFileAt(wantedFile, null, 0, { pin: true }),
      });
    }
    const detected =
      host.sources.find((source) => source.filePath === row.source.filePath)?.runner ?? row.source.runner;
    items.push({
      label: "Run With",
      submenu: NODE_RUNNERS.map((runner) => ({
        label: runner,
        hint: runner === row.source.runner ? "in use" : runner === detected ? "detected" : undefined,
        action: () => runnerOverrides.set(row.source.filePath, runner === detected ? null : runner),
      })),
    });
  }
  items.push(
    { separator: true },
    { label: "Expand All", action: host.expandAll },
    { label: "Collapse All", action: host.collapseAll },
    { label: "Refresh", action: host.refresh },
  );
  return items;
}
