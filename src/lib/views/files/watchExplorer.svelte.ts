// What the Files panel follows while it is open: workspace folders added or removed, the file opened in the editor,
// listings that changed on disk, and the LFS files of each repository. Call it while the component starts.
import { untrack } from "svelte";
import { isPseudoTab } from "$lib/stores/pseudoTabs";
import { repoStore } from "$lib/stores/repo.svelte";
import type { FolderRef } from "$lib/stores/workspacePaths";
import { lfsStore } from "../git/lfs/lfsStore.svelte";
import type { ExplorerTree } from "./explorerTree.svelte";
import { EMPTY_SELECTION, selectOnly } from "./selection";

export function watchExplorer(tree: ExplorerTree, folders: () => FolderRef[], repoRoots: () => string[]): void {
  // LFS files for the "LFS" tags, checked again while the panel is open when HEAD, the index or entries change.
  $effect(() => {
    for (const repo of repoStore.repos) {
      lfsStore.follow(repo.root, repoStore.treeVersions[repo.root] ?? 0);
    }
    lfsStore.retain(repoRoots());
  });

  // Load newly added folders (open) and forget removed ones.
  let loadedFolders = new Set<string>();
  $effect(() => {
    const current = new Set(folders().map((folder) => folder.root));
    const added = [...current].filter((root) => !loadedFolders.has(root));
    const removed = [...loadedFolders].filter((root) => !current.has(root));
    loadedFolders = current;
    untrack(() => {
      if (removed.length > 0) {
        tree.forgetFolders(removed);
      }
      if (added.length > 0) {
        tree.open(added);
        void tree.loadDirs(added, repoRoots());
      }
      if (current.size === 0) {
        tree.selection = EMPTY_SELECTION;
      }
    });
  });

  // Follow the file opened in the editor tab, unless it is already part of the selection
  // (a tab that followed a rename or move keeps the moved rows selected).
  $effect(() => {
    const openPath = repoStore.openFilePath;
    if (openPath && !isPseudoTab(openPath)) {
      untrack(() => {
        if (!tree.selection.paths.has(openPath)) {
          tree.selection = selectOnly(openPath);
        }
      });
    }
  });

  // Entries came or went (or ignore rules changed): reload the folders currently shown.
  // Content edits and status changes never change a listing; tones and marks follow the statuses.
  $effect(() => {
    void repoStore.listingVersion;
    void repoStore.repos;
    const timer = setTimeout(() => void tree.refreshLoaded(untrack(repoRoots)), 250);
    return () => clearTimeout(timer);
  });
}
