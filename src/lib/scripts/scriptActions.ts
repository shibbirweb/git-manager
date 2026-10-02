// Starting a script in the Run tab: the Scripts panel and the run_script MCP tool both go here.

import { settings } from "$lib/stores/settings.svelte";
import { terminalStore } from "$lib/terminal/terminalStore.svelte";
import type { NodeInstall, ProjectScript, ScriptSource } from "$lib/types";
import { toast } from "$lib/ui/toast.svelte";
import { nodePickFor, scriptRunSpec } from "./scriptRun";
import { terminalName } from "./scriptsModel";

/**
 * Runs in the Run tab as its own process, like JetBrains; running it again reuses its tab.
 * `askToStop` asks before restarting a script that still runs.
 */
export function runProjectScript(
  source: ScriptSource,
  script: ProjectScript,
  nodeInstalls: NodeInstall[],
  askToStop = true,
): Promise<void> {
  const pick = nodePickFor(source, nodeInstalls, settings.scriptNodeVersions);
  if (pick?.missing && pick.wanted) {
    toast.info(`Node ${pick.wanted.spec} is not installed`, `${pick.wanted.source} asks for it; running with the shell's default node.`);
  }
  return terminalStore.startRun(scriptRunSpec(source, script, pick), terminalName(source, script.name), askToStop);
}
