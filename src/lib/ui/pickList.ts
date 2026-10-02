// Rows of the filterable pick dialog (dialogs.pick), like VS Code's quick pick.

export interface PickItem<T extends string = string> {
  value: T;
  label: string;
  /** Shown dimmed after the label, e.g. "current" or a commit id. */
  description?: string;
  /** Items with the same group are listed under one heading, in the order given. */
  group?: string;
  /** Always listed, whatever the filter, like VS Code's "Create new branch..." entry. */
  pinned?: boolean;
  disabled?: boolean;
}

export type PickRow<T extends string = string> =
  | { kind: "group"; label: string }
  | { kind: "item"; item: PickItem<T> };

function matches(item: PickItem, words: string[]): boolean {
  const text = `${item.label} ${item.description ?? ""}`.toLowerCase();
  return words.every((word) => text.includes(word));
}

/** Items matching every word of `query` (case-insensitive), with group headings. */
export function pickRows<T extends string>(items: PickItem<T>[], query: string): PickRow<T>[] {
  const words = query.toLowerCase().split(/\s+/).filter((word) => word !== "");
  const rows: PickRow<T>[] = [];
  let group: string | undefined;
  for (const item of items) {
    if (!item.pinned && words.length > 0 && !matches(item, words)) {
      continue;
    }
    if (item.group !== undefined && item.group !== group) {
      rows.push({ kind: "group", label: item.group });
    }
    group = item.group;
    rows.push({ kind: "item", item });
  }
  return rows;
}

/** Index of the next enabled item row after `from` in `direction`, staying put at the ends. */
export function stepPick<T extends string>(rows: PickRow<T>[], from: number, direction: 1 | -1): number {
  for (let index = from + direction; index >= 0 && index < rows.length; index += direction) {
    const row = rows[index];
    if (row.kind === "item" && !row.item.disabled) {
      return index;
    }
  }
  return from;
}

/** The row highlighted after the filter changes: the first enabled item that is not pinned, else the first enabled one. */
export function initialPick<T extends string>(rows: PickRow<T>[], query: string): number {
  const enabled = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.kind === "item" && !row.item.disabled);
  if (query.trim() !== "") {
    const unpinned = enabled.find(({ row }) => row.kind === "item" && !row.item.pinned);
    if (unpinned) {
      return unpinned.index;
    }
  }
  return enabled[0]?.index ?? -1;
}
