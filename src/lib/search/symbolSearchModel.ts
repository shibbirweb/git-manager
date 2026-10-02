// Pure helpers for the Classes and Symbols results of the Search Everywhere popup
// (FileSearch.svelte): kind badges and rows with match highlighting.

import type { FolderRef } from "$lib/stores/workspacePaths";
import type { SymbolKind, SymbolSearchItem } from "$lib/types";
import { highlight, type TextPart } from "./fileSearchModel";

/** Badge colors, mapped to the syntax tokens in SymbolResult.svelte. */
export type KindTone = "type" | "interface" | "function" | "constant";

export interface KindInfo {
  letter: string;
  label: string;
  tone: KindTone;
}

export const KIND_INFO: Record<SymbolKind, KindInfo> = {
  class: { letter: "C", label: "Class", tone: "type" },
  interface: { letter: "I", label: "Interface", tone: "interface" },
  trait: { letter: "T", label: "Trait", tone: "interface" },
  struct: { letter: "S", label: "Struct", tone: "type" },
  enum: { letter: "E", label: "Enum", tone: "type" },
  type: { letter: "T", label: "Type", tone: "type" },
  protocol: { letter: "P", label: "Protocol", tone: "interface" },
  record: { letter: "R", label: "Record", tone: "type" },
  object: { letter: "O", label: "Object", tone: "type" },
  module: { letter: "N", label: "Module", tone: "interface" },
  function: { letter: "F", label: "Function", tone: "function" },
  method: { letter: "M", label: "Method", tone: "function" },
  constant: { letter: "K", label: "Constant", tone: "constant" },
};

export interface SymbolRow {
  /** Unique per definition; also the row key. */
  key: string;
  /** Absolute path of the file. */
  path: string;
  /** 1-based. */
  line: number;
  /** 1-based, UTF-16. */
  column: number;
  kind: KindInfo;
  nameParts: TextPart[];
  /** Empty when the definition has no container. */
  containerParts: TextPart[];
  /** "cart.ts:42". */
  location: string;
  /** The path below the workspace folder, led by its name when there are several. */
  title: string;
}

/** Rows for symbol results; the folder name leads the title only in a multi-folder workspace. */
export function symbolRows(items: SymbolSearchItem[], folders: FolderRef[]): SymbolRow[] {
  const several = folders.length > 1;
  return items.map((item) => {
    const name = item.relativePath.slice(item.relativePath.lastIndexOf("/") + 1);
    const folderName = several ? (folders.find((folder) => folder.root === item.root)?.name ?? null) : null;
    return {
      key: `${item.path}:${item.line}:${item.column}:${item.name}`,
      path: item.path,
      line: item.line,
      column: item.column,
      kind: KIND_INFO[item.kind] ?? KIND_INFO.function,
      nameParts: highlight(item.name, item.indices, 0),
      containerParts: item.container ? highlight(item.container, item.containerIndices, 0) : [],
      location: `${name}:${item.line}`,
      title: folderName ? `${folderName}/${item.relativePath}:${item.line}` : `${item.relativePath}:${item.line}`,
    };
  });
}
