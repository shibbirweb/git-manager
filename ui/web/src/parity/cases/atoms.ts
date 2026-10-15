import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const FILL = { width: "fills its parent" };
const TEXT = { width: "follows its text" };

export const atomCases: ParityCase[] = [
  {
    id: "history-day",
    sources: ["src/lib/localHistory/LocalHistoryDialog.svelte"],
    html: '<div class="versions" style="width: 300px"><div class="day">Today</div></div>',
    pairs: [{ name: "title", ref: ".day", lib: ".section-title", ignore: FILL }],
  },
  {
    id: "mcp-group",
    sources: ["src/lib/mcp/McpToolsDialog.svelte"],
    html:
      '<section style="width: 400px"><div class="group-head"><h3>Git</h3><span class="dim">3 of 5</span>' +
      '<div class="spacer"></div></div></section><span class="badge write">write</span>' +
      '<span class="call-error truncate">Not a repository</span>',
    pairs: [
      { name: "head", ref: ".group-head", lib: ".section-title", ignore: FILL },
      {
        name: "write",
        ref: ".badge.write",
        lib: ".pill",
        ignore: {
          ...TEXT,
          "background-color": "drift: 16% here, Pill warning is 18% like the other warning pills",
          "line-height": "drift: 17px here, Pill is 16px",
          "white-space": "one word",
        },
      },
    ],
  },
  {
    id: "shortcuts-foot",
    sources: ["src/lib/help/ShortcutsDialog.svelte"],
    html:
      '<div class="foot" style="width: 500px"><span class="dim">Menus with keys.</span><div class="foot-actions">' +
      '<button class="btn small">Change Shortcuts</button></div></div>',
    pairs: [{ name: "foot", ref: ".foot", lib: ".toolbar", ignore: FILL }],
  },
  {
    id: "conflicts-done",
    sources: ["src/lib/merge/ConflictsDialog.svelte"],
    html:
      `<div class="done" style="width: 400px"><div class="done-icon">${iconSvg("check", 22)}</div>` +
      "<p>All conflicts are resolved.</p></div>",
    pairs: [
      {
        name: "area",
        ref: ".done",
        lib: ".empty",
        ignore: {
          ...FILL,
          height: "the dialog sets it",
          "padding-left": "the dialog's body has the side padding",
          "padding-right": "the dialog's body has the side padding",
          "padding-bottom": "drift: 16px here, EmptyState area is 24px",
          "column-gap": "drift: 10px here, EmptyState is 8px",
        },
      },
      { name: "icon", ref: ".done-icon", lib: ".circle" },
    ],
  },
  {
    id: "recent-remove",
    sources: ["src/lib/recentFiles/RecentFiles.svelte"],
    html:
      '<div class="list" style="width: 400px"><div class="row selected"><span class="name">cart.ts</span>' +
      `<button class="remove">${iconSvg("x", 12)}</button></div></div><div class="hints"><span>Enter open</span>` +
      "</div>",
    pairs: [
      {
        name: "remove",
        ref: ".remove",
        lib: ".end .icon-button",
        states: ["hover"],
        ignore: { "column-gap": "one icon inside" },
      },
    ],
  },
  {
    id: "file-bar-bottom",
    sources: ["src/lib/views/files/FileView.svelte"],
    html:
      '<div class="file-view bar-bottom" style="display: flex; flex-direction: column; width: 400px">' +
      '<div class="file-bar">cart.ts</div></div>',
    pairs: [{ name: "bar", ref: ".file-bar", lib: ".toolbar", ignore: FILL }],
  },
];
