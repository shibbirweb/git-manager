import type { ParityCase } from "../types";

const FILL = { width: "fills its parent" };

export const listCases: ParityCase[] = [
  {
    id: "local-history",
    sources: ["src/lib/localHistory/LocalHistoryDialog.svelte"],
    html:
      '<div class="versions" style="height: 200px"><button class="version selected"><span class="time">10:42</span>' +
      '<span class="label safety">Before reset</span></button></div>' +
      '<button class="deleted-row"><span class="name">tax.ts</span><span class="dim folder">src</span>' +
      '<span class="dim when">2d</span></button>',
    pairs: [{ name: "pane", ref: ".versions", lib: ".pane", ignore: { height: "follows its rows" } }],
  },
];
