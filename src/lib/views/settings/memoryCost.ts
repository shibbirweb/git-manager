// What a setting costs in memory when it is on, shown as a small mark beside its name in
// Settings. The numbers were measured on the release app on a 3024 x 1964 display: a cold
// start with the setting on and one with it off, the same files and terminals each time, the
// median of three runs. Settings that stayed within the noise (about 10 MB) have no entry, except
// a feature with its own on/off switch for memory: it gets a `minor` entry, so the switch says
// what it saves. See docs/wiki/developer/Measuring-Setting-Memory.md to measure them again.

import type { Preferences } from "$lib/stores/settingsData";

export interface MemoryCost {
  /** Short text on the mark, like "+85 MB". */
  amount: string;
  /** One sentence for the tooltip: when the memory is used and what it scales with. */
  detail: string;
  /** Within the measuring noise: a quiet mark instead of the orange warning. */
  minor?: boolean;
}

export const MEMORY_COSTS: Partial<Record<keyof Preferences, MemoryCost>> = {
  fileIcons: {
    amount: "up to +25 MB",
    detail: "With 2,400 changed files, Minimal adds 2 to 10 MB and Material Icons 10 to 15 MB more. Fewer files cost less.",
  },
  syntaxHighlighting: {
    amount: "+35 MB",
    detail:
      "The language grammars and the colored text cost about 35 to 40 MB, nearly the same for one file or ten. Turned off while running, the full saving comes after a restart.",
  },
  renderWhitespace: {
    amount: "+9 MB with All",
    detail: "All draws a mark for every space and tab, about 9 MB more with a long file open.",
  },
  tabLimit: {
    amount: "+4 MB per tab",
    detail:
      "Every open file tab keeps its editor, about 4 MB each for an ordinary source file, until Unload hidden tabs frees it. A limit closes the oldest ones.",
  },
  markdownViewMode: {
    amount: "+35 to 140 MB",
    detail:
      "Editor and preview draws the page beside the code: about 35 MB more than Editor only for a plain file, and up to 140 MB with mermaid diagrams. Preview only costs a little less.",
  },
  blameGutter: {
    amount: "+35 MB",
    detail: "The wide blame column is drawn beside every line on screen, about 35 to 40 MB with a long file open.",
  },
  terminalScrollback: {
    amount: "up to +200 MB",
    detail:
      "Per terminal once the scrollback is full, about 2 KB per line in a wide window: +90 MB at 50,000 lines and +175 MB at 100,000, compared with 5,000.",
  },
  recentFiles: {
    amount: "about +1 MB",
    detail: "Keeping the list costs about 1 MB, within the measuring noise, and the popup uses about 17 MB more only while it is open.",
    minor: true,
  },
  terminalGpuAcceleration: {
    amount: "+70 MB",
    detail: "About 70 MB for the first terminal, mostly graphics memory, and about 10 MB for each other one.",
  },
};

export function memoryCost(setting: keyof Preferences): MemoryCost | null {
  return MEMORY_COSTS[setting] ?? null;
}

/** The tooltip and accessible name of the mark. */
export function memoryFlagTitle(cost: MemoryCost): string {
  return `${cost.minor ? "Memory" : "Uses more memory"}: ${cost.amount}. ${cost.detail}`;
}
