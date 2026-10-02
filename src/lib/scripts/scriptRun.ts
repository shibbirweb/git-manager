// What running a script starts, shared by the Scripts panel and the run_script MCP tool so
// both run it the same way: the runner picked with Run With and the Node version picked for
// its package.json.

import type { NodeInstall, ProjectScript, ScriptSource } from "$lib/types";
import type { RunSpec } from "$lib/terminal/runs";
import { type NodePick, pickNode } from "./nodeVersion";
import { scriptArgs, scriptCommand } from "./scriptsModel";

/** A package.json with its Run With choice applied. */
export function withRunner(source: ScriptSource, runner: string | null): ScriptSource {
  return runner && source.kind === "npm" ? { ...source, runner } : source;
}

/** The Node version a package.json's scripts run with; null for other kinds. */
export function nodePickFor(source: ScriptSource, nodeInstalls: NodeInstall[], nodeChoices: Record<string, string>): NodePick | null {
  if (source.kind !== "npm") {
    return null;
  }
  return pickNode(source.nodeVersion ?? null, nodeInstalls, nodeChoices[source.filePath] ?? null);
}

/** The command, and for package.json the Node version it runs with. */
export function describeRun(source: ScriptSource, script: ProjectScript, pick: NodePick | null): string {
  const command = scriptCommand(source.kind, source.runner, script.name);
  const install = pick?.install ?? null;
  return install ? `${command}    (Node ${install.version}, ${install.manager})` : command;
}

/** One Run tab session per script: running it again reuses its tab. */
export function scriptRunId(source: ScriptSource, script: ProjectScript): string {
  return JSON.stringify([source.filePath, script.name]);
}

export function scriptRunSpec(source: ScriptSource, script: ProjectScript, pick: NodePick | null): RunSpec {
  const { program, args } = scriptArgs(source.kind, source.runner, script.name);
  return {
    runId: scriptRunId(source, script),
    program,
    args,
    cwd: source.folderPath,
    nodeBinDir: pick?.install?.binDir ?? null,
    description: describeRun(source, script, pick),
  };
}
