// Editor tabs that are not files: commit tabs (commitTabs.ts), Git history and
// compare tabs (gitTabs.ts), terminals in the editor area (terminal/terminalTabs.ts) and
// Untitled tabs (untitledTabs.ts). Code that treats a tab path as a
// file (folder lookups, the Files panel, Back / Forward) checks this one helper,
// so a new kind of pseudo tab only has to be added here.

import { isCompareTab } from "$lib/compare/compareTabs";
import { isTerminalTab } from "$lib/terminal/terminalTabs";
import { isBranchTab } from "./branchTabs";
import { isCommitTab } from "./commitTabs";
import { isGitTab } from "./gitTabs";
import { isUntitledTab } from "./untitledTabs";

export function isPseudoTab(tabPath: string): boolean {
  return isCommitTab(tabPath) || isGitTab(tabPath) || isBranchTab(tabPath) || isTerminalTab(tabPath) || isCompareTab(tabPath) || isUntitledTab(tabPath);
}
