// Clear Cache keeps terminals running: before the page restarts, each terminal's place and
// screen are written down and handed to the backend (terminal_link.rs), and the new page
// rebuilds the same terminals from them. Pure, so what survives and what is checked is tested.

import type { RunSpec } from "./runs";
import type { TerminalLocation } from "./terminalTabs";

/** One terminal's place and state, as kept across the restart. */
export interface TerminalDescriptor {
  key: number;
  name: string;
  renamed: boolean;
  shellId: string | null;
  cwd: string | null;
  exited: boolean;
  exitCode: number | null;
  location: TerminalLocation;
  run: RunSpec | null;
  group: number;
  bell: boolean;
}

/** The panel around the terminals. */
export interface TerminalLayout {
  activeKey: number | null;
  runActiveKey: number | null;
  panelOpen: boolean;
  panelTab: "terminal" | "run" | "gitConsole" | "shelf";
  started: boolean;
  groupSizes: Record<number, number[]>;
}

/** What the backend keeps for a window (TerminalStash in terminal_link.rs). */
export interface TerminalStashData {
  layout: string;
  terminals: { terminalId: number | null; descriptor: string; snapshot: string }[];
}

/** A terminal rebuilt by the new page: its descriptor, its old screen, and its live shell if any. */
export interface RestoredTerminal {
  descriptor: TerminalDescriptor;
  snapshot: string;
  terminalId: number | null;
}

const LOCATIONS: readonly TerminalLocation[] = ["panel", "editor", "run"];
const PANEL_TABS: readonly TerminalLayout["panelTab"][] = ["terminal", "run", "gitConsole", "shelf"];

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function runSpec(value: unknown): RunSpec | null {
  const data = record(value);
  if (!data) {
    return null;
  }
  const args = Array.isArray(data.args) && data.args.every((arg) => typeof arg === "string") ? (data.args as string[]) : null;
  const runId = text(data.runId);
  const program = text(data.program);
  const cwd = text(data.cwd);
  if (runId === null || program === null || cwd === null || args === null) {
    return null;
  }
  return { runId, program, args, cwd, nodeBinDir: text(data.nodeBinDir), description: text(data.description) ?? "" };
}

export function describeTerminal(descriptor: TerminalDescriptor): string {
  return JSON.stringify(descriptor);
}

/** A descriptor written by `describeTerminal`; null when anything needed is missing or wrong. */
export function parseDescriptor(source: string): TerminalDescriptor | null {
  const data = record(parseJson(source));
  if (!data) {
    return null;
  }
  const key = count(data.key);
  const group = count(data.group);
  const name = text(data.name);
  const location = LOCATIONS.find((candidate) => candidate === data.location) ?? null;
  if (key === null || key === 0 || group === null || name === null || location === null) {
    return null;
  }
  const run = location === "run" ? runSpec(data.run) : null;
  if (location === "run" && run === null) {
    return null;
  }
  return {
    key,
    name,
    renamed: data.renamed === true,
    shellId: text(data.shellId),
    cwd: text(data.cwd),
    exited: data.exited === true,
    exitCode: typeof data.exitCode === "number" && Number.isInteger(data.exitCode) ? data.exitCode : null,
    location,
    run,
    group,
    bell: data.bell === true,
  };
}

export function describeLayout(layout: TerminalLayout): string {
  return JSON.stringify(layout);
}

/** The panel layout; anything unreadable falls back to a closed panel showing terminals. */
export function parseLayout(source: string): TerminalLayout {
  const data = record(parseJson(source)) ?? {};
  const sizes = record(data.groupSizes) ?? {};
  const groupSizes: Record<number, number[]> = {};
  for (const [group, value] of Object.entries(sizes)) {
    const groupNumber = Number(group);
    if (Number.isInteger(groupNumber) && Array.isArray(value) && value.every((size) => typeof size === "number" && size > 0 && size <= 1)) {
      groupSizes[groupNumber] = value as number[];
    }
  }
  return {
    activeKey: count(data.activeKey),
    runActiveKey: count(data.runActiveKey),
    panelOpen: data.panelOpen === true,
    panelTab: PANEL_TABS.find((tab) => tab === data.panelTab) ?? "terminal",
    started: data.started === true,
    groupSizes,
  };
}

/**
 * The terminals the new page rebuilds, in their old order. Unreadable ones and repeated keys are
 * left out; their shells are closed by the caller (`dropped`). A terminal whose shell had ended
 * comes back with its screen only.
 */
export function restoredTerminals(stash: TerminalStashData): { terminals: RestoredTerminal[]; dropped: number[] } {
  const terminals: RestoredTerminal[] = [];
  const dropped: number[] = [];
  const keys = new Set<number>();
  for (const stashed of stash.terminals) {
    const descriptor = parseDescriptor(stashed.descriptor);
    if (!descriptor || keys.has(descriptor.key)) {
      if (stashed.terminalId !== null) {
        dropped.push(stashed.terminalId);
      }
      continue;
    }
    keys.add(descriptor.key);
    terminals.push({ descriptor, snapshot: stashed.snapshot, terminalId: descriptor.exited ? null : stashed.terminalId });
  }
  return { terminals, dropped };
}

/** The layout made to fit the terminals that came back: the shown ones must exist. */
export function fittedLayout(layout: TerminalLayout, terminals: readonly RestoredTerminal[]): TerminalLayout {
  const panelKeys = terminals.filter((terminal) => terminal.descriptor.location === "panel").map((terminal) => terminal.descriptor.key);
  const runKeys = terminals.filter((terminal) => terminal.descriptor.location === "run").map((terminal) => terminal.descriptor.key);
  return {
    ...layout,
    activeKey: layout.activeKey !== null && panelKeys.includes(layout.activeKey) ? layout.activeKey : (panelKeys[0] ?? null),
    runActiveKey: layout.runActiveKey !== null && runKeys.includes(layout.runActiveKey) ? layout.runActiveKey : (runKeys[0] ?? null),
    started: layout.started || terminals.length > 0,
  };
}
