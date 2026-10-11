// The Terminals section of the memory details, like Orca's resource manager: one row per terminal,
// agent or run of this window with what its shell started, biggest first, and their sum.
import { baseName } from "$lib/stores/workspacePaths";
import type { TerminalMemory } from "$lib/types";
import type { TerminalEntry } from "./terminalStore.svelte";

export type TerminalMemoryKind = "agent" | "run" | "terminal";

export interface TerminalMemoryRow {
  terminalId: number;
  /** The terminal to show on click; null when this window no longer lists it. */
  terminalKey: number | null;
  kind: TerminalMemoryKind;
  label: string;
  /** The folder it runs in, "" when unknown. */
  folderName: string;
  bytes: number;
  processes: number;
}

type MemoryEntry = Pick<TerminalEntry, "key" | "terminalId" | "name" | "cwd" | "location" | "agent">;

function kindOf(entry: MemoryEntry | null): TerminalMemoryKind {
  if (entry?.agent) {
    return "agent";
  }
  return entry?.location === "run" ? "run" : "terminal";
}

export function terminalMemoryRows(measured: TerminalMemory[], entries: MemoryEntry[]): TerminalMemoryRow[] {
  const rows = measured.map((memory): TerminalMemoryRow => {
    const entry = entries.find((candidate) => candidate.terminalId === memory.terminalId) ?? null;
    const folder = entry?.agent?.folderPath ?? entry?.cwd ?? "";
    return {
      terminalId: memory.terminalId,
      terminalKey: entry?.key ?? null,
      kind: kindOf(entry),
      label: entry?.agent?.title || entry?.name || "Terminal",
      folderName: folder ? baseName(folder.replace(/\/+$/, "")) : "",
      bytes: memory.bytes,
      processes: memory.processes,
    };
  });
  return rows.sort((left, right) => right.bytes - left.bytes || left.label.localeCompare(right.label));
}

export function terminalMemoryTotal(rows: TerminalMemoryRow[]): number {
  return rows.reduce((sum, row) => sum + row.bytes, 0);
}

/** The row's tooltip: what it is and how many processes it counts. */
export function terminalMemoryTitle(row: TerminalMemoryRow): string {
  const kind = { agent: "Agent", run: "Run", terminal: "Terminal" }[row.kind];
  const processes = row.processes === 1 ? "1 process" : `${row.processes} processes`;
  const place = row.folderName ? ` in ${row.folderName}` : "";
  return `${kind}${place}: the shell and what it started, ${processes}`;
}
