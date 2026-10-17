// Quick Open's rows as the UI library's CommandPalette takes them: a heading row becomes the section of the rows
// under it, and a lone message (no results, still indexing, a line out of range) becomes the empty text.
import { partsToRanges } from "@nibtree/ui/logic/highlight";
import type { PaletteItem } from "@nibtree/ui/logic/palette";
import type { QuickRow } from "./quickOpenModel";

export interface QuickOpenItems {
  items: PaletteItem[];
  /** Shown when there are no items. */
  empty: string;
  /** Each item's row, by item id, for picking. */
  rows: Map<string, QuickRow>;
}

function itemFor(row: QuickRow): PaletteItem | null {
  switch (row.kind) {
    case "file": {
      const name = partsToRanges(row.file.nameParts);
      const folder = partsToRanges(row.file.folderParts);
      return {
        id: row.key,
        title: name.text,
        ranges: name.ranges,
        icon: "file",
        folder: folder.text,
        folderRanges: folder.ranges,
        tooltip: row.file.path,
      };
    }
    case "command": {
      const category = partsToRanges(row.command.categoryParts);
      const title = partsToRanges(row.command.titleParts);
      return {
        id: row.key,
        title: title.text,
        ranges: title.ranges,
        category: category.text,
        categoryRanges: category.ranges,
        checked: row.command.checked === true,
        disabled: !row.command.enabled,
        reason: row.command.reason ?? undefined,
        keys: row.command.shortcut ?? undefined,
      };
    }
    case "symbol": {
      const name = partsToRanges(row.symbol.nameParts);
      const container = partsToRanges(row.symbol.containerParts);
      const kind = row.symbol.kind;
      return {
        id: row.key,
        title: name.text,
        ranges: name.ranges,
        badge: { letter: kind.letter, tone: kind.tone, title: kind.label },
        container: container.text || undefined,
        folder: row.symbol.location,
        tooltip: row.symbol.title,
      };
    }
    case "outline": {
      const name = partsToRanges(row.item.nameParts);
      const kind = row.item.kind;
      return {
        id: row.key,
        title: name.text,
        ranges: name.ranges,
        badge: { letter: kind.letter, tone: kind.tone, title: kind.label },
        depth: row.item.depth,
        container: row.item.container ?? undefined,
        folder: `:${row.item.line}`,
      };
    }
    case "line":
      return row.target === null ? null : { id: row.key, title: row.label, icon: "arrow-right" };
    case "help":
      return { id: row.key, title: row.label, prefix: row.prefix };
    case "header":
    case "message":
      return null;
  }
}

export function quickOpenItems(rows: readonly QuickRow[]): QuickOpenItems {
  const items: PaletteItem[] = [];
  const byId = new Map<string, QuickRow>();
  let section: string | undefined;
  let empty = "";
  for (const row of rows) {
    if (row.kind === "header") {
      section = row.label;
      continue;
    }
    if (row.kind === "message" || (row.kind === "line" && row.target === null)) {
      empty = row.label;
      continue;
    }
    const item = itemFor(row);
    if (item) {
      items.push(section ? { ...item, section } : item);
      byId.set(item.id, row);
    }
  }
  return { items, empty, rows: byId };
}
