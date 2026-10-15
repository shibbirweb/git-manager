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
];
