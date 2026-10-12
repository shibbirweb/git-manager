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
  /** Levels of indent in an outline. */
  depth?: number;
  /** A symbol's container, dim after the title ("in Cart"). */
  container?: string;
  detail?: string;
  folder?: string;
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
