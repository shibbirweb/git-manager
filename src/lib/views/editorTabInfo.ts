// What an editor tab shows: its name, icon and tooltip for each kind of tab (file, Untitled, terminal, commit, git
// view, branch and file comparison), as the UI library's TabStrip takes them.
import type { EditorTabData } from "@nibtree/ui/components/EditorTab.svelte";
import type { IconName } from "@nibtree/ui/icons";
import { compareTabTooltip } from "$lib/compare/compareStore.svelte";
import { isCompareTab } from "$lib/compare/compareTabs";
import { branchTabTitle, parseBranchTabPath } from "$lib/stores/branchTabs";
import { parseCommitTabPath } from "$lib/stores/commitTabs";
import { gitTabTitle, parseGitTabPath } from "$lib/stores/gitTabs";
import { repoStore } from "$lib/stores/repo.svelte";
import type { FileTab } from "$lib/stores/tabs";
import { unsavedText } from "$lib/stores/unsavedText.svelte";
import { isUntitledTab } from "$lib/stores/untitledTabs";
import { shellNameFor } from "$lib/terminal/terminals";
import { terminalStore } from "$lib/terminal/terminalStore.svelte";
import { parseTerminalTabPath } from "$lib/terminal/terminalTabs";

/** The Diff tab's id: never a path, which is absolute or starts with a tab kind. */
export const DIFF_TAB_ID = "diff-tab";

/** A commit tab's tooltip: the hash, the subject and the repository. */
function commitTitle(tabPath: string): string {
  const ref = parseCommitTabPath(tabPath);
  if (!ref) {
    return tabPath;
  }
  const summary = repoStore.commitTabs[tabPath]?.summary;
  const repoName = ref.repoRoot.slice(ref.repoRoot.lastIndexOf("/") + 1);
  return `Commit ${ref.commitId.slice(0, 8)}${summary ? `: ${summary}` : ""} (${repoName})`;
}

/** A terminal tab's tooltip: its name, shell and folder. */
function terminalTitle(terminalKey: number): string {
  const entry = terminalStore.find(terminalKey);
  if (!entry) {
    return "Terminal";
  }
  return [
    entry.name,
    `Shell: ${shellNameFor(entry.shellId, terminalStore.shells)}`,
    `Folder: ${entry.cwd ?? "~"}`,
  ].join("\n");
}

function iconFor(tabPath: string): IconName {
  if (parseTerminalTabPath(tabPath) !== null) {
    return "terminal";
  }
  if (parseCommitTabPath(tabPath)) {
    return "commit";
  }
  const gitTab = parseGitTabPath(tabPath);
  if (gitTab) {
    return gitTab.kind === "compare" ? "git-compare" : gitTab.kind === "reflog" ? "undo" : "history";
  }
  return parseBranchTabPath(tabPath) || isCompareTab(tabPath) ? "git-compare" : "file";
}

function titleFor(tab: FileTab, name: string): string {
  const terminalKey = parseTerminalTabPath(tab.path);
  if (terminalKey !== null) {
    return terminalTitle(terminalKey);
  }
  if (parseCommitTabPath(tab.path)) {
    return commitTitle(tab.path);
  }
  const gitTab = parseGitTabPath(tab.path);
  if (gitTab) {
    return gitTabTitle(gitTab).title;
  }
  const branchTab = parseBranchTabPath(tab.path);
  if (branchTab) {
    return branchTabTitle(branchTab).title;
  }
  if (isUntitledTab(tab.path)) {
    return `${name} (not saved to a file yet)`;
  }
  return compareTabTooltip(tab.path) ?? `${tab.path}${tab.preview ? " (preview: double-click to keep open)" : ""}`;
}

/** One tab for the strip; `label` is its name and the folder that tells it apart from a namesake. */
export function editorTabData(tab: FileTab, label: { name: string; hint: string | null } | undefined): EditorTabData {
  const terminalKey = parseTerminalTabPath(tab.path);
  const terminalName = terminalKey !== null ? terminalStore.find(terminalKey)?.name : undefined;
  const untitledName = isUntitledTab(tab.path) ? unsavedText.title(tab.path) : null;
  const name = terminalName ?? untitledName ?? label?.name ?? tab.path;
  return {
    id: tab.path,
    label: name,
    icon: iconFor(tab.path),
    hint: label?.hint ?? undefined,
    title: titleFor(tab, name),
    preview: tab.preview,
    dirty: tab.dirty,
    pinned: tab.pinned === true,
    mono: parseCommitTabPath(tab.path) !== null,
  };
}

/** The Diff tab in front of the first group's tabs while a change is selected. */
export function diffTabData(selected: { path: string; area: string }): EditorTabData {
  return {
    id: DIFF_TAB_ID,
    label: selected.path.split("/").pop() ?? "Diff",
    icon: "git-compare",
    hint: "Diff",
    title: `Diff: ${selected.path} (${selected.area === "staged" ? "staged" : "working tree"})`,
    fixed: true,
  };
}
