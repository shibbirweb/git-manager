// What a CommandPalette row can show. One shape covers Go to File, Recent Files, commands, symbols, the outline and
// the help rows, so the palette and its row part agree on it.
import type { FileIconView } from "../components/FileIcon.svelte";
import type { IconName } from "../icons";

export interface PaletteBadge {
  letter: string;
  tone: "type" | "interface" | "function" | "constant";
  title?: string;
}

export interface PaletteItem {
  id: string;
  title: string;
  /** Matched character ranges in `title`, drawn bold. */
  ranges?: [number, number][];
  icon?: IconName;
  /** A file type icon instead of `icon`. */
  fileIcon?: FileIconView;
  /** A symbol kind badge instead of an icon. */
  badge?: PaletteBadge;
  /** A command's group, dim before its title ("Git: Pull"). */
  category?: string;
  /** Matched character ranges in `category`. */
  categoryRanges?: [number, number][];
  /** Levels of indent in an outline. */
  depth?: number;
  /** A symbol's container, dim after the title ("in Cart"). */
  container?: string;
  detail?: string;
  folder?: string;
  /** Matched character ranges in `folder`. */
  folderRanges?: [number, number][];
  /** The row's tooltip, such as a file's full path. */
  tooltip?: string;
  keys?: string;
  /** A help row's prefix key, such as ">" for commands. */
  prefix?: string;
  section?: string;
  /** A command that is on, with a check after its title. */
  checked?: boolean;
  disabled?: boolean;
  /** Why a disabled command cannot run, shown in italics. */
  reason?: string;
  /** A file's git state, which colors its name. */
  tone?: "added" | "modified" | "conflict" | "deleted";
  /** A file with unsaved changes: a dot after its name. */
  dirty?: boolean;
}

/** Rows moved by Page Up and Page Down. */
export const PALETTE_PAGE = 10;

/** How far a key moves a palette's highlight: arrows and Ctrl+N / Ctrl+P one row, Page keys ten; 0 for others. */
export function paletteStep(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">): number {
  const ctrlOnly = event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
  if (event.key === "ArrowDown" || (ctrlOnly && event.key === "n")) {
    return 1;
  }
  if (event.key === "ArrowUp" || (ctrlOnly && event.key === "p")) {
    return -1;
  }
  return event.key === "PageDown" ? PALETTE_PAGE : event.key === "PageUp" ? -PALETTE_PAGE : 0;
}

/** The next position among `count` pickable rows: single steps wrap around, page steps stop at the ends. */
export function paletteMove(at: number, count: number, by: number): number {
  if (count === 0) {
    return -1;
  }
  if (Math.abs(by) === 1) {
    return (Math.max(0, at) + by + count) % count;
  }
  return Math.max(0, Math.min(count - 1, at + by));
}
