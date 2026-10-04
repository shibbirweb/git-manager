// The Files panel's own clipboard for Cut and Copy: absolute paths, not file contents. It
// outlives the panel being hidden, and holds nothing but a few strings.

import { movedPath, pathsUnder, type PathMove } from "$lib/stores/workspacePaths";

export type ClipboardMode = "cut" | "copy";

class FileClipboard {
  mode = $state<ClipboardMode | null>(null);
  paths = $state.raw<string[]>([]);

  set(mode: ClipboardMode, paths: string[]): void {
    this.mode = paths.length > 0 ? mode : null;
    this.paths = paths;
  }

  clear(): void {
    this.mode = null;
    this.paths = [];
  }

  /** Paths moved or renamed: a pending cut or copy follows them. */
  follow(moves: PathMove[]): void {
    if (this.paths.length > 0) {
      this.paths = this.paths.map((path) => movedPath(path, moves));
    }
  }

  /** Paths went to the Trash: forget them and anything inside them. */
  forget(removed: string[]): void {
    const gone = new Set(pathsUnder(this.paths, removed));
    if (gone.size > 0) {
      this.set(this.mode ?? "copy", this.paths.filter((path) => !gone.has(path)));
    }
  }
}

export const fileClipboard = new FileClipboard();
