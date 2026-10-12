import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const FILL = { width: "fills its parent" };
const TEXT = { width: "follows its text" };
const EXPLORER = "src/lib/views/files/FileExplorer.svelte";
const ROW = "src/lib/views/sidebar/RowContent.svelte";
// Drift, snapped to IconButton mini: the shelf's buttons keep .icon-btn's 6px sides, the sidebar's have 3px.
const SHELF = {
  width: "drift: 25px in the shelf, mini is 20px like the sidebar's",
  "padding-left": "drift: see width",
  "padding-right": "drift: see width",
};

const fileRow = (classes: string, name: string, extra = "") =>
  `<div class="row ${classes}" style="position: relative; padding-left: 22px"><span class="chevron"></span>` +
  `<span class="icon">${iconSvg("file", 14)}</span><span class="name truncate">${name}</span>${extra}</div>`;

export const stateCases: ParityCase[] = [
  {
    id: "tree-states",
    sources: [EXPLORER],
    html:
      '<div class="list" style="width: 300px">' +
      fileRow("cut", "cart.ts") +
      fileRow("ignored", "dist") +
      fileRow("folder-root", "storefront") +
      fileRow("drop-target", "tax.ts", '<span class="lfs-tag">LFS</span>') +
      "</div>",
    pairs: [
      { name: "cut name", ref: ".cut .name", lib: ".cut .name", ignore: FILL },
      { name: "cut icon", ref: ".cut .icon", lib: ".cut .icon" },
      { name: "ignored", ref: ".ignored .name", lib: ".ignored .name", ignore: FILL },
      { name: "ignored icon", ref: ".ignored .icon", lib: ".ignored .icon" },
      { name: "root", ref: ".folder-root .name", lib: ".folder-root .name", ignore: FILL },
      { name: "drop", ref: ".drop-target", lib: ".drop-target", ignore: { ...FILL, "padding-left": "by depth" } },
      { name: "lfs", ref: ".lfs-tag", lib: ".tag" },
    ],
  },
  {
    id: "tree-drop-root",
    sources: [EXPLORER],
    html: '<div class="list drop-root" style="width: 300px; height: 80px"></div>',
    pairs: [{ name: "list", ref: ".list", lib: ".tree", ignore: { ...FILL, height: "the panel's height" } }],
  },
  {
    id: "sidebar-stash",
    sources: [ROW, "src/lib/views/Sidebar.svelte"],
    html:
      '<div class="sidebar-row selected" style="width: 300px"><span class="icon dim">' +
      `${iconSvg("stash", 14)}</span><span class="label truncate">WIP on main</span>` +
      '<span class="stash-ref dim">stash@{0}</span><span class="stash-actions"><button class="icon-btn row-btn">' +
      `${iconSvg("check", 13)}</button><button class="icon-btn row-btn danger">${iconSvg("x", 13)}</button>` +
      "</span></div>",
    pairs: [
      { name: "actions", ref: ".stash-actions", lib: ".actions", ignore: TEXT },
      { name: "button", ref: ".row-btn:not(.danger)", lib: ".actions .icon-button:first-child", states: ["hover"] },
      { name: "danger", ref: ".row-btn.danger", lib: ".actions .icon-button:last-child", states: ["hover"] },
    ],
  },
  {
    id: "sidebar-worktree",
    sources: [ROW, "src/lib/views/Sidebar.svelte"],
    html:
      `<div class="sidebar-row" style="width: 300px"><span class="icon dim">${iconSvg("folder-git", 14)}</span>` +
      '<span class="label truncate gone">feature <span class="worktree-path dim">~/wt/feature</span></span>' +
      '<span class="wt-tag dim">prunable</span></div>',
    pairs: [
      { name: "label", ref: ".label", lib: ".label", ignore: FILL },
      { name: "path", ref: ".worktree-path", lib: ".path", ignore: TEXT },
      { name: "tag", ref: ".wt-tag", lib: ".detail", ignore: TEXT },
    ],
  },
  {
    id: "shelf-actions",
    sources: ["src/lib/shelf/ShelfPanel.svelte"],
    html:
      '<ul class="list" style="width: 300px"><li style="position: relative"><span class="entry-actions" ' +
      `style="display: flex"><button class="icon-btn tiny">${iconSvg("arrow-up", 13)}</button>` +
      `<button class="icon-btn tiny danger">${iconSvg("trash", 13)}</button></span></li></ul>`,
    pairs: [
      { name: "button", ref: ".tiny:not(.danger)", lib: ".actions .icon-button:first-child", ignore: SHELF },
      { name: "danger", ref: ".tiny.danger", lib: ".actions .icon-button:last-child", ignore: SHELF },
    ],
  },
  {
    id: "terminal-drop",
    sources: ["src/lib/terminal/TerminalView.svelte"],
    html: '<div class="terminal-view drop-over" style="position: relative; height: 160px"></div>',
    pairs: [{ name: "outline", ref: ".terminal-view", lib: ".terminal-view", pseudo: "::after", ignore: FILL }],
  },
];
