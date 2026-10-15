import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const FILL = { width: "fills its parent" };
const TEXT = { width: "follows its text" };
const TAB = {
  width: "fills the tab",
  "font-size": "inherits the tab's",
  "font-weight": "inherits the tab's",
};

export const pickerCases: ParityCase[] = [
  {
    id: "conflicts-table",
    sources: ["src/lib/merge/ConflictsDialog.svelte"],
    html:
      '<div class="body"><div class="table" role="listbox"><div class="row header"><span class="name">Name</span>' +
      '<span class="side truncate">Yours</span><span class="side truncate">Theirs</span></div>' +
      '<div class="row item selected"><span class="name truncate"><span class="file">cart.ts</span></span>' +
      '<span class="side">Modified</span><span class="side">Deleted</span></div></div></div>',
    pairs: [
      { name: "table", ref: ".table", lib: ".table", ignore: FILL },
      { name: "header", ref: ".row.header", lib: ".row.header", ignore: FILL },
      { name: "row", ref: ".row.item", lib: ".row.item", states: ["hover"], ignore: FILL },
    ],
  },
  {
    id: "drag-ghost",
    sources: ["src/lib/views/files/FileExplorer.svelte"],
    html: '<div class="drag-ghost" style="left: 14px; top: 10px">3 files</div>',
    pairs: [{ name: "ghost", ref: ".drag-ghost", lib: ".drag-ghost", ignore: { transform: "the library offsets it" } }],
  },
  {
    id: "rename-field",
    sources: ["src/lib/terminal/TerminalPanel.svelte"],
    html: '<div class="tab"><input class="rename" value="zsh" /><input class="rename invalid" value="build" /></div>',
    pairs: [
      { name: "field", ref: ".rename:not(.invalid)", lib: ".rename:not(.invalid)", states: ["focus"], ignore: TAB },
      { name: "invalid", ref: ".rename.invalid", lib: ".rename.invalid", ignore: TAB },
    ],
  },
  {
    id: "corner-card",
    sources: ["src/lib/terminal/TerminalView.svelte"],
    html:
      '<div class="terminal" style="position: relative; height: 120px"><div class="agent-ended" role="status">' +
      '<span>Agent exited</span><button class="btn small">Restart</button></div></div>',
    pairs: [{ name: "card", ref: ".agent-ended", lib: ".corner-card", ignore: TEXT }],
  },
  {
    id: "pane-row",
    sources: ["src/lib/terminal/TerminalPanel.svelte"],
    html:
      '<div class="views" style="position: relative; height: 120px"><div class="panes">' +
      '<div class="pane" style="flex: 1 1 0px"></div><div class="pane focused after-first" ' +
      'style="flex: 1 1 0px"></div></div></div>',
    pairs: [
      { name: "panes", ref: ".panes", lib: ".panes", ignore: FILL },
      { name: "pane", ref: ".pane:not(.after-first)", lib: ".pane:not(.after-first)" },
      { name: "second", ref: ".pane.after-first", lib: ".pane.after-first" },
      { name: "focus line", ref: ".pane.focused", lib: ".pane.focused", pseudo: "::after" },
    ],
  },
  {
    id: "crumb-popup",
    sources: ["src/lib/navBar/NavigationBar.svelte"],
    html:
      '<div class="nav-popup" style="position: relative; width: 300px"><div class="field">' +
      `${iconSvg("search", 12)}<input type="text" placeholder="Type to search" /></div>` +
      '<div class="list"><div class="row modified selected"><span class="icon"></span><span class="name">cart.ts' +
      '</span></div><div class="row added"><span class="icon"></span><span class="name">tax.ts</span></div>' +
      '<div class="row"><span class="icon"></span><span class="name">lib</span><span class="more">' +
      `${iconSvg("chevron-right", 11)}</span></div></div></div>`,
    pairs: [
      { name: "popup", ref: ".nav-popup", lib: ".popup", ignore: FILL },
      { name: "field", ref: ".field", lib: ".field", ignore: FILL },
      { name: "input", ref: ".field input", lib: ".field input", ignore: FILL },
      { name: "selected", ref: ".row.selected", lib: ".row.selected", ignore: FILL },
      { name: "added", ref: ".row.added .name", lib: ".row.added .name", ignore: FILL },
      { name: "more", ref: ".more", lib: ".more" },
    ],
  },
  {
    id: "split-handle",
    sources: ["src/lib/diff/DiffView.svelte"],
    html:
      '<div class="diff-host" style="position: relative; height: 80px"><div class="split-handle" style="left: 50%" ' +
      'role="separator" tabindex="0"></div></div>',
    pairs: [
      { name: "handle", ref: ".split-handle", lib: ".split-handle", states: ["hover"] },
      { name: "line", ref: ".split-handle", lib: ".split-handle", pseudo: "::after" },
    ],
  },
  {
    id: "split-grid",
    sources: ["src/lib/views/Workspace.svelte"],
    html:
      '<div class="editor-area" style="height: 120px"><section class="editor-group" style="left: 0; top: 0; ' +
      'width: 50%; height: 100%"></section><section class="editor-group inner-left" style="left: 50%; top: 0; ' +
      'width: 50%; height: 100%"></section><div class="group-splitter" style="left: 50%; top: 0; height: 100%">' +
      "</div></div>",
    pairs: [
      { name: "area", ref: ".editor-area", lib: ".area", ignore: FILL },
      { name: "group", ref: ".editor-group:not(.inner-left)", lib: ".group:not(.inner-left)", ignore: FILL },
      { name: "inner", ref: ".editor-group.inner-left", lib: ".group.inner-left", ignore: FILL },
      { name: "splitter", ref: ".group-splitter", lib: ".splitter" },
    ],
  },
];
