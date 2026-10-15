import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const FILL = { width: "fills its parent" };

export const largerCases: ParityCase[] = [
  {
    id: "command-palette",
    sources: ["src/lib/quickOpen/QuickOpen.svelte"],
    html:
      '<div class="popup" style="position: absolute; transform: none; left: 0; top: 0">' +
      `<div class="field">${iconSvg("search", 14)}<input class="query" placeholder="File name" />` +
      '<span class="status">2 files</span></div><div class="list"><div class="canvas" style="height: 52px">' +
      '<div class="row selected" style="top: 0"><span class="title">cart.ts</span></div>' +
      '<div class="row" style="top: 26px"><span class="title">tax.ts</span></div></div></div></div>',
    pairs: [
      { name: "popup", ref: ".popup", lib: ".popup", ignore: { height: "follows its rows" } },
      { name: "field", ref: ".field", lib: ".field", ignore: FILL },
      { name: "query", ref: ".query", lib: ".query", ignore: FILL },
      { name: "status", ref: ".status", lib: ".status" },
      { name: "selected row", ref: ".row.selected", lib: ".row.selected", ignore: FILL },
      { name: "row", ref: ".row:not(.selected)", lib: ".row:not(.selected)", ignore: FILL },
    ],
  },
];
