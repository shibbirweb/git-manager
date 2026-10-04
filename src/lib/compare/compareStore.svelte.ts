// Compare any two files: the file chosen with "Select for Compare", the clipboard texts of
// open Compare with Clipboard tabs (kept in memory only, freed when their tab closes) and
// the actions the Files panel, the editor tab menu and the File menu run.

import { api, errorMessage } from "$lib/api";
import { quickOpen } from "$lib/quickOpen/quickOpenStore.svelte";
import { fileCommands } from "$lib/stores/fileCommands.svelte";
import { isPseudoTab } from "$lib/stores/pseudoTabs";
import { repoStore } from "$lib/stores/repo.svelte";
import { baseName, folderFor } from "$lib/stores/workspacePaths";
import type { CompareSide } from "$lib/types";
import type { MenuItem } from "$lib/ui/menu.svelte";
import { toast } from "$lib/ui/toast.svelte";
import { type CompareEntry, compareMenuPlan } from "./compareSelection";
import { clipIdsOf, type CompareSideRef, compareTabPath, compareTabTitle, parseCompareTabPath } from "./compareTabs";

/** What a side sends to compare_files, and whether it is an unsaved editor buffer. */
export interface SideInput {
  side: CompareSide;
  unsaved: boolean;
}

class CompareStore {
  /** "Select for Compare": absolute path of the file to compare the next one with. */
  selected = $state<string | null>(null);
  private clips = new Map<number, string>();
  private nextClip = 1;

  private open(left: CompareSideRef, right: CompareSideRef): void {
    repoStore.openPseudoTab(compareTabPath({ left, right }));
  }

  /** The chosen file, while it is still inside the workspace. */
  private selectedInWorkspace(): string | null {
    const filePath = this.selected;
    return filePath && folderFor(repoStore.workspace?.folders ?? [], filePath) ? filePath : null;
  }

  selectForCompare(filePath: string): void {
    this.selected = filePath;
  }

  compareFiles(leftPath: string, rightPath: string): void {
    this.open({ kind: "file", filePath: leftPath }, { kind: "file", filePath: rightPath });
  }

  /** The chosen file on the left, `filePath` on the right. */
  compareWithSelected(filePath: string): void {
    const selected = this.selectedInWorkspace();
    if (selected && selected !== filePath) {
      this.compareFiles(selected, filePath);
    }
  }

  /** The clipboard text on the left and the file (with unsaved edits) on the right. */
  async compareWithClipboard(filePath: string): Promise<void> {
    if (isPseudoTab(filePath)) {
      return;
    }
    let text: string;
    try {
      text = await api.readClipboardText();
    } catch (error) {
      toast.error("Could not read the clipboard", errorMessage(error));
      return;
    }
    if (!text) {
      toast.info("The clipboard has no text");
      return;
    }
    const clipId = this.nextClip++;
    this.clips.set(clipId, text);
    this.open({ kind: "clipboard", clipId }, { kind: "file", filePath });
  }

  /** Quick Open picks the file to compare `filePath` with. */
  compareWith(filePath: string): void {
    if (quickOpen.isOpen || isPseudoTab(filePath)) {
      return;
    }
    quickOpen.open("", {
      placeholder: `Compare ${baseName(filePath)} with...`,
      onPick: (pickedPath) => {
        if (pickedPath === filePath) {
          toast.info("Pick another file to compare with");
          return;
        }
        this.compareFiles(filePath, pickedPath);
      },
    });
  }

  /** The text of a clipboard side; null once its tab has closed (or after a restart). */
  clipText(clipId: number): string | null {
    return this.clips.get(clipId) ?? null;
  }

  /** Frees the clipboard texts no open tab shows. */
  prune(): void {
    const used = new Set(repoStore.tabs.flatMap((tab) => clipIdsOf(tab.path)));
    for (const clipId of [...this.clips.keys()]) {
      if (!used.has(clipId)) {
        this.clips.delete(clipId);
      }
    }
  }

  /**
   * What a side compares: a file open with unsaved edits sends the editor's text (its path
   * names the language), any other file is read from disk. Null for a clipboard text that is gone.
   */
  sideInput(side: CompareSideRef): SideInput | null {
    if (side.kind === "clipboard") {
      const text = this.clipText(side.clipId);
      return text === null ? null : { side: { filePath: null, text }, unsaved: false };
    }
    const buffer = repoStore.isDirty(side.filePath) ? fileCommands.text(side.filePath) : null;
    return { side: { filePath: side.filePath, text: buffer }, unsaved: buffer !== null };
  }

  /** The Files panel's compare items for the entries the menu is for. */
  filesPanelItems(entries: readonly CompareEntry[]): MenuItem[] {
    const plan = compareMenuPlan(entries, this.selectedInWorkspace());
    const items: MenuItem[] = [];
    const pair = plan.pair;
    if (pair) {
      items.push({ label: "Compare Selected", action: () => this.compareFiles(pair[0], pair[1]) });
    }
    const withSelected = plan.withSelected;
    if (withSelected) {
      items.push({
        label: "Compare with Selected",
        hint: baseName(withSelected[0]),
        action: () => this.compareFiles(withSelected[0], withSelected[1]),
      });
    }
    const select = plan.select;
    if (select) {
      items.push({ label: "Select for Compare", action: () => this.selectForCompare(select) });
    }
    return items;
  }

  /** The editor tab menu's compare items for a file tab. */
  fileTabItems(filePath: string): MenuItem[] {
    return [
      { separator: true },
      { label: "Compare with Clipboard", action: () => void this.compareWithClipboard(filePath) },
      { label: "Compare with...", action: () => this.compareWith(filePath) },
    ];
  }
}

export const compareStore = new CompareStore();

/** The tooltip of a compare tab; null for other tabs. */
export function compareTabTooltip(tabPath: string): string | null {
  const ref = parseCompareTabPath(tabPath);
  return ref ? compareTabTitle(ref).title : null;
}
