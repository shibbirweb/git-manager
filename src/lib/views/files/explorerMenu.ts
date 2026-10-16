// The Files panel's menus: a row's (open, history, git, file operations, reveal, terminal, copy path), several
// selected rows' (compare, file operations) and the one below the rows (new file, paste into the workspace folder).
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { errorMessage } from "$lib/api";
import { compareStore } from "$lib/compare/compareStore.svelte";
import { formatKeys } from "$lib/help/shortcuts";
import { ignoreMenu } from "$lib/ignore/ignoreActions";
import { localHistory } from "$lib/localHistory/localHistory.svelte";
import { platformFromUserAgent } from "$lib/menu/menuSpec";
import { repoStore } from "$lib/stores/repo.svelte";
import { settings } from "$lib/stores/settings.svelte";
import { folderFor, locateAbsolute, relativeTo } from "$lib/stores/workspacePaths";
import { terminalStore } from "$lib/terminal/terminalStore.svelte";
import { contextMenu, type MenuItem } from "$lib/ui/menu.svelte";
import { toast } from "$lib/ui/toast.svelte";
import { platformName } from "$lib/update/releases";
import { pickAndAddFolder } from "../repoPicker";
import { copyText, type ExplorerHost, type ExplorerOps } from "./explorerOps";
import { fileClipboard } from "./fileClipboard.svelte";
import type { TreeEntry } from "./folderListings";
import { FILE_OP_LABELS, fileOpAccelerator, fileOpGroups, type FileOpTarget } from "./fileOps";
import { revealLabel, terminalFolderFor } from "./reveal";
import { EMPTY_SELECTION, selectOnly } from "./selection";
import type { WorkspaceTones } from "./tones";

const PLATFORM = platformFromUserAgent(navigator.userAgent);
const REVEAL_LABEL = revealLabel(platformName(navigator.userAgent));

export interface MenuHost extends ExplorerHost {
  ops: ExplorerOps;
  changes: () => WorkspaceTones;
  /** The selected rows that are visible, top down. */
  selectedEntries: () => TreeEntry[];
  toggle: (dirPath: string) => void;
}

async function reveal(absolutePath: string): Promise<void> {
  try {
    await revealItemInDir(absolutePath);
  } catch (error) {
    toast.error(`${REVEAL_LABEL} failed`, errorMessage(error));
  }
}

/** The file operation items for `targets`, each group after a separator. */
function fileOpMenu(host: MenuHost, targets: FileOpTarget[]): MenuItem[] {
  const items: MenuItem[] = [];
  for (const group of fileOpGroups(targets, fileClipboard.paths.length > 0)) {
    items.push({ separator: true });
    for (const item of group) {
      const accelerator = fileOpAccelerator(item.op, PLATFORM);
      items.push({
        label: FILE_OP_LABELS[item.op],
        disabled: item.disabled,
        hint: accelerator ? formatKeys(accelerator, PLATFORM) : undefined,
        action: () => void host.ops.run(item.op, targets),
      });
    }
  }
  return items;
}

/** What a folder row offers before the file operations. */
function folderItems(entry: TreeEntry, expanded: boolean, toggle: () => void): MenuItem[] {
  const absolute = entry.path;
  const items: MenuItem[] = [
    { label: expanded ? "Collapse" : "Expand", action: toggle },
    { label: "Show Recently Deleted", action: () => localHistory.openDeleted([absolute]) },
  ];
  if (entry.isRepo) {
    const isActive = repoStore.repo?.root === absolute;
    items.push({
      label: isActive ? "Active Repository" : "Set as Active Repository",
      disabled: isActive,
      action: () => void repoStore.setActiveRepo(absolute),
    });
  } else if (!locateAbsolute(repoStore.repos, absolute)) {
    items.push({ label: "Initialize Repository Here", action: () => void repoStore.initRepository(absolute) });
  }
  if (entry.isFolderRoot) {
    items.push(
      { separator: true },
      { label: "Add Folder to Workspace...", action: () => void pickAndAddFolder() },
      { label: "Remove Folder from Workspace", action: () => void repoStore.removeFolder(absolute) },
    );
  }
  return items;
}

/** What a file row offers before the file operations. */
function fileItems(entry: TreeEntry, conflicted: boolean): MenuItem[] {
  const absolute = entry.path;
  const location = locateAbsolute(repoStore.repos, absolute);
  const items: MenuItem[] = [
    { label: "Open", action: () => void repoStore.openFile(absolute, { pin: true }) },
    { label: "Open Preview", action: () => void repoStore.openFile(absolute) },
    ...(settings.splitEditor
      ? [{ label: "Open to the Side", action: () => void repoStore.openFile(absolute, { pin: true, toSide: true }) }]
      : []),
    { label: "Show Local History", action: () => localHistory.openFile(absolute) },
  ];
  if (conflicted && location) {
    items.push({
      label: "Resolve Conflict...",
      action: () => void repoStore.openMerge(location.repoPath, location.repo.root),
    });
  }
  return [...items, { separator: true }, ...compareStore.filesPanelItems([entry])];
}

export function openRowMenu(host: MenuHost, event: MouseEvent, entry: TreeEntry, expanded: boolean): void {
  const tree = host.tree;
  const selected = tree.selection.paths.has(entry.path) ? host.selectedEntries() : [];
  if (selected.length > 1) {
    // Two selected files offer Compare Selected above the file operations (whose first item is a separator).
    const compareItems = compareStore.filesPanelItems(selected);
    contextMenu.open(event, [...compareItems, ...fileOpMenu(host, selected).slice(compareItems.length > 0 ? 0 : 1)]);
    return;
  }
  tree.selection = selectOnly(entry.path);
  const absolute = entry.path;
  const folder = folderFor(host.folders(), absolute);
  const relative = folder ? relativeTo(folder.root, absolute) : absolute;
  const location = locateAbsolute(repoStore.repos, absolute);
  let items: MenuItem[];
  if (entry.deleted) {
    items = [{ label: "Show in Changes", action: () => settings.setLeftPanel("changes") }];
    if (!entry.isDir) {
      items.push({ label: "Show Local History", action: () => localHistory.openFile(absolute) });
    }
  } else if (entry.isDir) {
    items = folderItems(entry, expanded, () => host.toggle(absolute));
  } else {
    items = fileItems(entry, host.changes().tone(absolute) === "conflict");
  }
  items.push(...fileOpMenu(host, [entry]));
  const ignoreItem = location && !entry.deleted ? ignoreMenu(location.repo.root, location.repoPath, entry.isDir) : null;
  if (ignoreItem) {
    items.push({ separator: true }, ignoreItem);
  }
  if (!entry.deleted) {
    items.push(
      { separator: true },
      { label: REVEAL_LABEL, action: () => void reveal(absolute) },
      {
        label: "Open in Integrated Terminal",
        action: () => void terminalStore.create({ folderPath: terminalFolderFor(absolute, entry.isDir) }),
      },
    );
  }
  items.push(
    { separator: true },
    { label: "Copy Path", action: () => void copyText(absolute) },
    { label: "Copy Relative Path", disabled: relative === "", action: () => void copyText(relative) },
  );
  contextMenu.open(event, items);
}

/** Right-click below the rows (or in an empty folder): new files and pastes go into the workspace folder. */
export function openBackgroundMenu(host: MenuHost, event: MouseEvent): void {
  const root = host.singleRoot();
  if (!root) {
    return;
  }
  host.tree.selection = EMPTY_SELECTION;
  contextMenu.open(event, fileOpMenu(host, [{ path: root, isDir: true, isFolderRoot: true, deleted: false }]).slice(1));
}
