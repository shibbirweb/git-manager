import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const FILL = { width: "fills its parent" };

export const barCases: ParityCase[] = [
  {
    id: "toolbar-tab",
    sources: ["src/lib/views/git/FileHistoryTab.svelte"],
    html: `<div class="toolbar">${iconSvg("history", 14)}<span class="title">History</span></div>`,
    pairs: [{ name: "toolbar", ref: ".toolbar", lib: ".toolbar", ignore: FILL }],
  },
  {
    id: "toolbar-editor",
    sources: ["src/lib/diff/DiffView.svelte"],
    html:
      '<div class="toolbar"><span class="counter dim">2 of 5</span><div class="divider"></div>' +
      `<button class="toggle active" aria-pressed="true">${iconSvg("list-tree", 13)}<span>Collapse</span></button>` +
      `<button class="toggle layout-button">${iconSvg("split-rows", 13)}</button></div>`,
    pairs: [
      { name: "toolbar", ref: ".toolbar", lib: ".toolbar", ignore: FILL },
      { name: "divider", ref: ".divider", lib: ".divider" },
      { name: "toggle on", ref: ".toggle.active", lib: ".toggle.active", states: ["hover"] },
      { name: "icon toggle", ref: ".toggle.layout-button", lib: ".toggle.icon-only", states: ["hover"] },
    ],
  },
  {
    id: "toolbar-merge",
    sources: ["src/lib/merge/MergeEditor.svelte"],
    html:
      '<div class="toolbar"><div class="divider"></div><button class="toggle active">Highlight words</button></div>' +
      '<div class="footer"><span class="hint dim">2 left</span></div>',
    pairs: [
      { name: "toolbar", ref: ".toolbar", lib: ".toolbar.merge", ignore: FILL },
      { name: "divider", ref: ".divider", lib: ".toolbar.merge .divider" },
      { name: "outline toggle", ref: ".toggle", lib: ".toggle.outline" },
      { name: "footer", ref: ".footer", lib: ".toolbar.footer", ignore: FILL },
    ],
  },
  {
    id: "section-title",
    sources: ["src/lib/views/git/ChangesTab.svelte"],
    html: '<div class="section-title">Staged <span class="dim">3</span></div>',
    pairs: [{ name: "bar", ref: ".section-title", lib: ".section-title.bar", ignore: FILL }],
  },
  {
    id: "section-title-list",
    sources: ["src/lib/views/git/BranchCompareTab.svelte"],
    html: '<div class="section-title">Commits only in main <span class="dim">4</span></div>',
    pairs: [{ name: "list", ref: ".section-title", lib: ".section-title.list", ignore: FILL }],
  },
];
