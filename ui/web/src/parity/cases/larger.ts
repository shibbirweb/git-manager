import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const FILL = { width: "fills its parent" };

export const largerCases: ParityCase[] = [
  {
    id: "data-table",
    sources: ["src/lib/views/LogView.svelte"],
    html:
      '<div class="columns dim"><div class="col-subject">Subject</div><div class="col-author">Author</div>' +
      '<div class="col-date">Date</div><div class="col-hash">Hash</div></div>' +
      '<div class="row selected" style="position: relative; height: 26px"><div class="col-subject">' +
      '<span class="summary">Round tax</span></div><div class="col-author">Ada</div>' +
      '<div class="col-date">1 Oct</div><div class="col-hash">a1b2c3d</div></div>',
    pairs: [
      { name: "header", ref: ".columns", lib: ".columns", ignore: FILL },
      { name: "row", ref: ".row", lib: ".row.selected", ignore: FILL },
      { name: "author cell", ref: ".row .col-author", lib: ".row .col:nth-child(2)" },
      { name: "date cell", ref: ".row .col-date", lib: ".row .col:nth-child(3)" },
      { name: "hash cell", ref: ".row .col-hash", lib: ".row .col:nth-child(4)" },
    ],
  },
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
  {
    id: "shortcut-recorder",
    sources: ["src/lib/views/settings/KeyboardShortcuts.svelte"],
    html: '<button class="keys"><kbd>⌘K</kbd></button>',
    pairs: [
      { name: "keys", ref: ".keys", lib: ".keys", states: ["hover"] },
      { name: "kbd", ref: "kbd", lib: "kbd" },
    ],
  },
];
