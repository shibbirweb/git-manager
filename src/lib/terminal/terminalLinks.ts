// File path links in a terminal: paths in the output that exist in the workspace open in the editor on Cmd+click
// (Ctrl+click elsewhere). The provider asks the backend which paths exist, for the lines on screen only, and
// underlines a hovered path only while the modifier is held.
import type { IBufferCell, IDisposable, ILink, ILinkDecorations, Terminal } from "@xterm/xterm";
import { api } from "$lib/api";
import { navigation } from "$lib/stores/navigation.svelte";
import { repoStore } from "$lib/stores/repo.svelte";
import { type CellText, FileExistenceCache, type FileLink, fileLinksForLine, lineCells } from "./fileLinks";

export class TerminalFileLinks {
  private provider: IDisposable | null = null;
  private scroll: IDisposable | null = null;
  private cache: FileExistenceCache | null = null;
  /** The decorations of the file link under the pointer: underlined only while Cmd (Ctrl) is held. */
  private hovered: ILinkDecorations | null = null;

  /** `folder` is where relative paths start: the shell's reported folder, else where it started (null: none). */
  constructor(
    private readonly isMac: boolean,
    private readonly folder: () => string | null,
  ) {}

  /** Registers the link provider on `instance`, or (null, or off) removes it with its cache. */
  set(instance: Terminal | null, enabled: boolean): void {
    if (!instance || !enabled) {
      this.provider?.dispose();
      this.provider = null;
      this.scroll?.dispose();
      this.scroll = null;
      this.cache = null;
      this.stopHover();
      return;
    }
    if (this.provider) {
      return;
    }
    const roots = () => (repoStore.workspace?.folders ?? []).map((folder) => folder.root);
    const cache = new FileExistenceCache((filePaths) => api.realFiles(roots(), filePaths));
    this.cache = cache;
    // The cache only covers the lines on screen: scrolling shows others.
    this.scroll = instance.onScroll(() => cache.clear());
    this.provider = instance.registerLinkProvider({
      provideLinks: (bufferLine, callback) => {
        void this.provide(instance, cache, bufferLine).then(callback, () => callback(undefined));
      },
    });
  }

  private modifierHeld(event: MouseEvent | KeyboardEvent): boolean {
    return this.isMac ? event.metaKey : event.ctrlKey;
  }

  /** While a file link is hovered, pressing or releasing Cmd (Ctrl) shows or hides its underline. */
  private readonly onModifier = (event: KeyboardEvent): void => {
    if (this.hovered) {
      const held = this.modifierHeld(event);
      this.hovered.underline = held;
      this.hovered.pointerCursor = held;
    }
  };

  private stopHover(): void {
    this.hovered = null;
    window.removeEventListener("keydown", this.onModifier, true);
    window.removeEventListener("keyup", this.onModifier, true);
  }

  private async provide(
    instance: Terminal,
    cache: FileExistenceCache,
    bufferLine: number,
  ): Promise<ILink[] | undefined> {
    const line = instance.buffer.active.getLine(bufferLine - 1);
    if (!line) {
      return undefined;
    }
    const cells: CellText[] = [];
    let scratch: IBufferCell | undefined;
    for (let x = 0; x < line.length; x += 1) {
      scratch = line.getCell(x, scratch);
      cells.push({ chars: scratch?.getChars() ?? "", width: scratch?.getWidth() ?? 1 });
    }
    const { text, cellAt } = lineCells(cells);
    const links = await fileLinksForLine(text, {
      folderPath: this.folder(),
      workspaceFolders: repoStore.workspace?.folders ?? [],
      cache,
    });
    if (links.length === 0 || this.cache !== cache) {
      return undefined;
    }
    return links.map((link) => this.xtermLink(link, bufferLine, cellAt));
  }

  private xtermLink(link: FileLink, bufferLine: number, cellAt: number[]): ILink {
    const startCell = cellAt[link.start] ?? 0;
    const endCell = cellAt[link.end - 1] ?? startCell;
    const decorations: ILinkDecorations = { underline: false, pointerCursor: false };
    return {
      range: { start: { x: startCell + 1, y: bufferLine }, end: { x: endCell + 1, y: bufferLine } },
      text: link.text,
      decorations,
      activate: (event) => {
        if (this.modifierHeld(event)) {
          const line = link.line === null ? null : link.line - 1;
          const column = link.column === null ? null : link.column - 1;
          void navigation.openFileAt(link.filePath, line, column, { pin: true });
        }
      },
      hover: (event) => {
        this.hovered = decorations;
        decorations.underline = this.modifierHeld(event);
        decorations.pointerCursor = this.modifierHeld(event);
        window.addEventListener("keydown", this.onModifier, true);
        window.addEventListener("keyup", this.onModifier, true);
      },
      leave: () => {
        decorations.underline = false;
        decorations.pointerCursor = false;
        this.stopHover();
      },
    };
  }
}
