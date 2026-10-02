// Which installed Node a package.json's scripts run with: the one its .nvmrc (or similar)
// asks for, one picked by hand, or the shell's own. The backend puts that version's bin
// folder first on the run's PATH (src-tauri/src/run_process.rs), like JetBrains does.

import type { NodeInstall, NodeWanted } from "$lib/types";

/** Stored per package.json: "default" uses the shell's node; anything else is a bin folder. */
export const SHELL_DEFAULT = "default";

type Version = [number, number, number];

function parseVersion(text: string): Version | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(text.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function compare(a: Version, b: Version): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/** nvm's LTS code names. */
const LTS_NAMES: Record<string, number> = {
  argon: 4,
  boron: 6,
  carbon: 8,
  dubnium: 10,
  erbium: 12,
  fermium: 14,
  gallium: 16,
  hydrogen: 18,
  iron: 20,
  jod: 22,
  krypton: 24,
};

type Test = (version: Version) => boolean;

/** "18", "18.x", "v18.20", "18.20.4" and the "*" / "x" wildcards: what is given, the rest any. */
function partial(text: string): (number | null)[] | null {
  const parts = text.replace(/^v/, "").split(".");
  if (parts.length > 3 || parts.some((part) => part === "")) {
    return null;
  }
  const numbers: (number | null)[] = [];
  for (const part of parts) {
    if (part === "x" || part === "X" || part === "*") {
      numbers.push(null);
    } else if (/^\d+$/.test(part)) {
      numbers.push(Number(part));
    } else {
      return null;
    }
  }
  // A number after a wildcard means nothing more.
  const firstWild = numbers.indexOf(null);
  return firstWild < 0 ? numbers : numbers.slice(0, firstWild);
}

/** The lowest version a partial covers, and the first one it no longer covers. */
function bounds(given: number[]): { low: Version; high: Version | null } {
  const [major = 0, minor = 0, patch = 0] = given;
  const low: Version = [major, minor, patch];
  if (given.length === 0) {
    return { low, high: null };
  }
  if (given.length === 1) {
    return { low, high: [major + 1, 0, 0] };
  }
  if (given.length === 2) {
    return { low, high: [major, minor + 1, 0] };
  }
  return { low, high: [major, minor, patch + 1] };
}

function comparator(token: string): Test | null {
  const match = /^(>=|<=|>|<|=|\^|~>?)?\s*(.+)$/.exec(token);
  if (!match) {
    return null;
  }
  const operator = match[1] ?? "";
  const given = partial(match[2]);
  if (!given) {
    return null;
  }
  const numbers = given as number[];
  const { low, high } = bounds(numbers);
  switch (operator) {
    case "":
    case "=":
      return (version) => compare(version, low) >= 0 && (high === null || compare(version, high) < 0);
    case ">=":
      return (version) => compare(version, low) >= 0;
    case ">":
      return (version) => (high === null ? false : compare(version, high) >= 0);
    case "<":
      return (version) => compare(version, low) < 0;
    case "<=":
      return (version) => high === null || compare(version, high) < 0;
    case "^": {
      // The first non-zero part may not change: ^18.2 is >=18.2.0 <19.0.0, ^0.4 is <0.5.0.
      const index = numbers.length === 0 ? -1 : Math.max(0, Math.min(numbers.findIndex((part) => part !== 0), numbers.length - 1));
      const upper: Version | null =
        index < 0 ? null : index === 0 ? [low[0] + 1, 0, 0] : index === 1 ? [low[0], low[1] + 1, 0] : [low[0], low[1], low[2] + 1];
      return (version) => compare(version, low) >= 0 && (upper === null || compare(version, upper) < 0);
    }
    default: {
      // ~18.2.3 is >=18.2.3 <18.3.0; ~18 is any 18.
      const upper: Version | null = numbers.length === 0 ? null : numbers.length === 1 ? [low[0] + 1, 0, 0] : [low[0], low[1] + 1, 0];
      return (version) => compare(version, low) >= 0 && (upper === null || compare(version, upper) < 0);
    }
  }
}

/** One `||` part of a range: comparators that must all hold; "18 - 20" is a span. */
function comparatorSet(text: string): Test | null {
  const span = /^(\S+)\s+-\s+(\S+)$/.exec(text.trim());
  const tokens = span ? [`>=${span[1]}`, `<=${span[2]}`] : text.trim().replace(/(>=|<=|>|<|=|\^|~>?)\s+/g, "$1").split(/\s+/);
  const tests: Test[] = [];
  for (const token of tokens.filter(Boolean)) {
    const test = comparator(token);
    if (!test) {
      return null;
    }
    tests.push(test);
  }
  return tests.length > 0 ? (version) => tests.every((test) => test(version)) : null;
}

/** A test for a version spec, or null when it is not one this understands. */
export function specTest(spec: string): Test | null {
  const text = spec.trim().toLowerCase();
  if (["node", "latest", "current", "stable", "*", "x"].includes(text)) {
    return () => true;
  }
  if (text === "lts" || text === "lts/*") {
    return (version) => version[0] >= 4 && version[0] % 2 === 0;
  }
  if (text.startsWith("lts/")) {
    const major = LTS_NAMES[text.slice(4)];
    return major === undefined ? null : (version) => version[0] === major;
  }
  const sets = text.split("||").map(comparatorSet);
  if (sets.length === 0 || sets.some((set) => set === null)) {
    return null;
  }
  return (version) => sets.some((set) => set?.(version) ?? false);
}

/** The newest installed version that satisfies `spec`. */
export function matchNodeSpec(spec: string, installs: NodeInstall[]): NodeInstall | null {
  const test = specTest(spec);
  if (!test) {
    return null;
  }
  let best: { install: NodeInstall; version: Version } | null = null;
  for (const install of installs) {
    const version = parseVersion(install.version);
    if (version && test(version) && (best === null || compare(version, best.version) > 0)) {
      best = { install, version };
    }
  }
  return best?.install ?? null;
}

export interface NodePick {
  /** The version to run with; null runs the shell's own node. */
  install: NodeInstall | null;
  /** auto: from the project's version file; default: the shell's; chosen: picked by hand. */
  mode: "auto" | "default" | "chosen";
  wanted: NodeWanted | null;
  /** The project asks for a version that is not installed. */
  missing: boolean;
}

export function pickNode(wanted: NodeWanted | null, installs: NodeInstall[], choice: string | null): NodePick {
  if (choice === SHELL_DEFAULT) {
    return { install: null, mode: "default", wanted, missing: false };
  }
  const chosen = choice ? installs.find((install) => install.binDir === choice) : undefined;
  if (chosen) {
    return { install: chosen, mode: "chosen", wanted, missing: false };
  }
  // A picked version that was uninstalled since falls back to Auto.
  if (!wanted) {
    return { install: null, mode: "auto", wanted, missing: false };
  }
  const install = matchNodeSpec(wanted.spec, installs);
  return { install, mode: "auto", wanted, missing: install === null };
}

/** The short badge on a package.json row. */
export function nodeBadge(pick: NodePick): string {
  if (pick.install) {
    return `node ${pick.install.version}`;
  }
  if (pick.missing && pick.wanted) {
    return `node ${pick.wanted.spec} missing`;
  }
  return "";
}

/** Its tooltip: which version, and why. */
export function nodeTitle(pick: NodePick): string {
  const asked = pick.wanted ? `${pick.wanted.source} asks for ${pick.wanted.spec}` : "";
  if (pick.mode === "default") {
    return "Node: the shell's default";
  }
  if (pick.mode === "chosen" && pick.install) {
    return `Node ${pick.install.version} (${pick.install.manager}), picked by you${asked ? `; ${asked}` : ""}`;
  }
  if (pick.install) {
    return `Node ${pick.install.version} (${pick.install.manager}): ${asked}`;
  }
  if (pick.missing) {
    return `${asked}, which is not installed. The shell's default node runs it.`;
  }
  return "Node: the shell's default (the project does not ask for a version)";
}
