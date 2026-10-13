import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const HEIGHT = { height: "follows its rows" };
const TEXT = { width: "follows its text" };
// A column Stack against the app's cell: the width must match; the words inside are compared on their own.
const COLUMN = {
  height: "a line of text",
  color: "the words inside carry the tone",
  "font-family": "the words inside carry the font",
  "font-size": "the words inside carry the size",
  "line-height": "the words inside carry the size",
  cursor: "the row's",
  "white-space": "the words inside truncate",
  "column-gap": "a column of one item",
  "border-top-color": "follows the words' color",
  "border-right-color": "follows the words' color",
  "border-bottom-color": "follows the words' color",
  "border-left-color": "follows the words' color",
};

// The builder pieces (Row, List, Link's disclosure, Card's states) composed like the app's own rows.
export const builderCases: ParityCase[] = [
  {
    id: "row-history",
    sources: ["src/lib/views/git/FileHistoryTab.svelte"],
    html:
      '<div class="list" role="listbox" tabindex="0"><div class="entry"><span class="hash mono">a1b2c3d</span>' +
      '<span class="subject truncate">Round tax</span></div><div class="entry selected"><span class="hash mono">' +
      '9f8e7d6</span><span class="subject truncate">Add the cart</span></div></div>',
    pairs: [
      { name: "row", ref: ".entry:not(.selected)", lib: ".row:not(.selected)", states: ["hover"] },
      { name: "selected", ref: ".entry.selected", lib: ".row.selected" },
      { name: "hash column", ref: ".entry .hash", lib: ".row .stack", ignore: COLUMN },
      { name: "hash", ref: ".entry .hash", lib: ".row .stack .text", ignore: { width: "the column holds the width" } },
    ],
  },
  {
    id: "row-list",
    sources: ["src/lib/views/git/BranchFileList.svelte"],
    html:
      '<div class="files" role="listbox" tabindex="0"><div class="file"><span class="name truncate">cart.ts</span>' +
      '</div><div class="file selected"><span class="name truncate">tax.ts</span></div></div>',
    pairs: [
      { name: "row", ref: ".file:not(.selected)", lib: ".row:not(.selected)", states: ["hover"] },
      { name: "selected", ref: ".file.selected", lib: ".row.selected" },
    ],
  },
  {
    id: "row-entry",
    sources: ["src/lib/views/git/PushDialog.svelte"],
    html:
      '<div class="commits"><div class="commit"><span class="subject truncate">Round tax</span>' +
      '<span class="author truncate dim">Ada</span><span class="when dim">2 hours ago</span>' +
      '<span class="hash mono dim">a1b2c3d</span></div><div class="commit"><span class="subject">Add</span>' +
      "</div></div>",
    pairs: [
      { name: "entry", ref: ".commit", lib: ".row" },
      { name: "author", ref: ".commit .author", lib: ".row > .stack:nth-child(2)", ignore: COLUMN },
      { name: "when", ref: ".commit .when", lib: ".row > .stack:nth-child(3)", ignore: COLUMN },
      { name: "hash", ref: ".commit .hash", lib: ".row > .stack:nth-child(4)", ignore: COLUMN },
    ],
  },
  {
    id: "row-large",
    sources: ["src/lib/views/Welcome.svelte"],
    html:
      `<button class="learn-item">${iconSvg("book", 18)}<span class="text"><span class="name">Documentation` +
      '</span><span class="dim">A guide to every feature.</span></span></button>',
    pairs: [
      {
        name: "large",
        ref: ".learn-item",
        lib: ".row",
        states: ["hover"],
        ignore: { ...TEXT, cursor: "a Row is a list item (default cursor); the app's tile is a link-like button" },
      },
    ],
  },
  {
    id: "link-expanded",
    sources: ["src/lib/update/WhatsNewDialog.svelte"],
    html: `<button class="older-toggle">${iconSvg("chevron-right", 12)} Earlier versions</button>`,
    pairs: [
      {
        name: "toggle",
        ref: ".older-toggle",
        lib: ".link",
        states: ["hover"],
        ignore: {
          ...TEXT,
          "padding-top": "drift: the app's toggle keeps 4px above and below; a Link sits in the flow",
          "padding-bottom": "drift: the app's toggle keeps 4px above and below; a Link sits in the flow",
          height: "follows the padding above",
        },
        appBugs: Object.fromEntries(
          ["color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color"].map(
            (name) => [`hover:${name}`, "the app's toggle stays dim on hover; quiet links brighten"],
          ),
        ),
      },
    ],
  },
  {
    id: "card-states",
    sources: ["src/lib/ai/AiPanel.svelte"],
    html:
      '<div class="card selected" style="margin: 0"><div style="height: 40px"></div></div>' +
      '<div class="card missing" style="margin: 0"><div style="height: 40px"></div></div>',
    pairs: [
      { name: "selected", ref: ".card.selected", lib: ".card.selected", ignore: HEIGHT },
      { name: "missing", ref: ".card.missing", lib: ".card.faded", ignore: HEIGHT },
    ],
  },
];
