import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const tab = (classes: string, icon: string, name: string, hint = "") =>
  `<div class="tab ${classes}"><button class="tab-main">${icon}<span class="name">${name}</span>` +
  `${hint ? `<span class="hint">${hint}</span>` : ""}</button><button class="tab-close">` +
  `<span class="dot"></span><span class="x">${iconSvg("x", 12)}</span></button></div>`;

export const navigationCases: ParityCase[] = [
  {
    id: "tab-strip",
    sources: ["src/lib/views/EditorTabs.svelte"],
    html:
      '<div class="tab-strip">' +
      tab("active dirty", iconSvg("file", 13), "cart.ts") +
      tab("preview", iconSvg("file", 13), "README.md") +
      tab("", iconSvg("git-compare", 13), "app.css", "Working Tree") +
      "</div>",
    pairs: [
      { name: "strip", ref: ".tab-strip", lib: ".tab-strip", ignore: { width: "fills the editor group" } },
      { name: "active", ref: ".tab.active", lib: ".tab.active" },
      { name: "accent line", ref: ".tab.active", lib: ".tab.active", pseudo: "::before" },
      { name: "preview", ref: ".tab.preview", lib: ".tab.preview", states: ["hover"] },
      { name: "preview name", ref: ".tab.preview .name", lib: ".tab.preview .name" },
      { name: "tab main", ref: ".tab.active .tab-main", lib: ".tab.active .tab-main" },
      { name: "hint", ref: ".hint", lib: ".hint" },
      { name: "close", ref: ".tab.preview .tab-close", lib: ".tab.preview .tab-close", states: ["hover"] },
      { name: "dirty dot", ref: ".tab.dirty .dot", lib: ".tab.dirty .dot" },
      { name: "x", ref: ".tab.preview .x", lib: ".tab.preview .x" },
    ],
  },
  {
    id: "panel-tabs",
    sources: ["src/lib/terminal/TerminalPanel.svelte"],
    html:
      '<header class="head"><div class="tabs"><button class="tab selected">Terminal</button>' +
      '<button class="tab">Run</button><button class="tab">Git Console</button></div></header>',
    pairs: [
      { name: "selected", ref: ".tab.selected", lib: ".tab.selected", ignore: { height: "the header's height" } },
      { name: "underline", ref: ".tab.selected", lib: ".tab.selected", pseudo: "::after" },
      {
        name: "other",
        ref: ".tab:nth-child(2)",
        lib: ".tab:nth-child(2)",
        states: ["hover"],
        ignore: { height: "the header's height" },
      },
    ],
  },
  {
    id: "tree-row",
    sources: ["src/lib/views/files/FileExplorer.svelte"],
    html:
      '<div class="row selected" style="position: relative; padding-left: 22px">' +
      `<span class="chevron">${iconSvg("chevron-down", 12)}</span>${iconSvg("folder", 14)}` +
      '<span class="name">src</span></div>',
    pairs: [
      {
        name: "row",
        ref: ".row",
        lib: ".row.selected",
        ignore: { width: "fills the tree", "padding-left": "by depth" },
      },
      { name: "chevron", ref: ".chevron", lib: ".row.selected .chevron" },
    ],
  },
  {
    id: "collapsible",
    sources: ["src/lib/views/changes/RepoSection.svelte"],
    html:
      `<div class="group-header"><button class="group-toggle">${iconSvg("chevron-down", 13)}` +
      '<span class="group-label">Staged Changes</span><span class="group-count">2</span></button></div>',
    pairs: [
      { name: "header", ref: ".group-header", lib: ".header", states: ["hover"], ignore: { width: "fills the list" } },
      { name: "toggle", ref: ".group-toggle", lib: ".toggle", ignore: { width: "fills the header" } },
      { name: "title", ref: ".group-label", lib: ".title" },
      { name: "count", ref: ".group-count", lib: ".count" },
    ],
  },
  {
    id: "list-row",
    sources: ["src/lib/ui/DialogHost.svelte"],
    html:
      '<div class="pick-list" style="width: 420px"><button class="pick-row highlighted">' +
      '<span class="pick-label truncate">main</span><span class="pick-description truncate">current</span></button>' +
      '<button class="pick-row"><span class="pick-label truncate">develop</span></button></div>',
    pairs: [
      {
        name: "highlighted",
        ref: ".pick-row.highlighted",
        lib: ".row.highlighted",
        ignore: { width: "fills the list" },
      },
      {
        name: "row",
        ref: ".pick-row:nth-child(2)",
        lib: ".row:not(.highlighted)",
        ignore: { width: "fills the list" },
      },
      { name: "description", ref: ".pick-description", lib: ".description" },
    ],
  },
  {
    id: "breadcrumbs",
    sources: ["src/lib/navBar/NavigationBar.svelte"],
    html:
      `<nav class="nav-bar"><button class="crumb folder repo has-icon">${iconSvg("folder-git", 14)}` +
      `<span class="crumb-name">storefront</span></button><span class="sep">${iconSvg("chevron-right", 12)}</span>` +
      '<button class="crumb folder"><span class="crumb-name">src</span></button>' +
      `<span class="sep">${iconSvg("chevron-right", 12)}</span>` +
      `<button class="crumb file has-icon">${iconSvg("file", 14)}` +
      '<span class="crumb-name">cart.ts</span></button></nav>',
    pairs: [
      { name: "repo", ref: ".crumb.repo", lib: ".crumb.repo", ignore: { "min-width": "icon room" } },
      { name: "folder", ref: ".crumb:not(.repo):not(.file)", lib: ".crumb.folder", states: ["hover"] },
      { name: "file", ref: ".crumb.file", lib: ".crumb.file" },
      { name: "separator", ref: ".sep", lib: ".sep" },
    ],
  },
];
