import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const FILL = { width: "fills its parent" };
const TEXT = { width: "follows its text" };

export const pieceCases: ParityCase[] = [
  {
    id: "patch-view",
    sources: ["src/lib/views/git/LineHistoryTab.svelte"],
    html:
      '<div class="patch mono"><div class="line file">--- a/cart.ts</div><div class="line hunk">@@ -1 +1 @@</div>' +
      '<div class="line deleted">-a</div><div class="line added">+b</div></div>',
    pairs: [
      {
        name: "patch",
        ref: ".patch",
        lib: ".patch",
        ignore: {
          ...FILL,
          height: "fills its pane",
          "background-color": "the library paints the editor background on the patch, the app on the pane around it",
        },
      },
      { name: "file", ref: ".line.file", lib: ".line.file", ignore: TEXT },
      { name: "hunk", ref: ".line.hunk", lib: ".line.hunk", ignore: TEXT },
      { name: "added", ref: ".line.added", lib: ".line.added", ignore: TEXT },
    ],
  },
  {
    id: "app-header",
    sources: ["src/lib/views/Header.svelte"],
    html:
      '<header class="header"><div class="left"><div class="divider"></div>' +
      `<span class="counts dim"><span>2${iconSvg("arrow-up", 11)}</span></span></div>` +
      '<div class="right"><div class="busy"><span class="truncate">Fetching</span></div></div></header>',
    pairs: [
      { name: "header", ref: ".header", lib: ".header", ignore: FILL },
      { name: "start", ref: ".left", lib: ".start", ignore: FILL },
      { name: "end", ref: ".right", lib: ".end", ignore: TEXT },
      { name: "divider", ref: ".divider", lib: ".divider" },
      { name: "busy", ref: ".busy", lib: ".busy", ignore: TEXT },
    ],
  },
  {
    id: "welcome-pieces",
    sources: ["src/lib/views/Welcome.svelte"],
    html:
      `<div class="logo">${iconSvg("merge", 22)}</div>` +
      `<button class="tile"><span class="tile-icon">${iconSvg("folder", 24)}</span>Open</button>` +
      `<button class="learn-item">${iconSvg("book", 18)}<span class="text"><span class="name">Docs</span>` +
      '<span class="dim">A guide.</span></span></button>' +
      '<ul class="projects"><li class="row selected"><button class="project"><span class="badge badge-cyan">SF</span>' +
      '<span class="text"><span class="name truncate">storefront</span><span class="path dim truncate">~/sf</span>' +
      "</span></button></li></ul>",
    pairs: [
      { name: "logo", ref: ".logo", lib: ".logo" },
      { name: "tile", ref: ".tile", lib: ".tile" },
      { name: "tile icon", ref: ".tile-icon", lib: ".tile-icon", states: ["hover"] },
      { name: "learn item", ref: ".learn-item", lib: ".resource", states: ["hover"], ignore: TEXT },
      { name: "learn title", ref: ".learn-item .name", lib: ".resource .title" },
      {
        name: "project tile",
        ref: ".badge",
        lib: ".avatar",
        ignore: {
          "background-color": "the library puts the gradient's deep color under it for contrast checks",
          cursor: "the app's tile sits in the project row's button",
        },
      },
    ],
  },
  {
    id: "symbol-badge",
    sources: ["src/lib/search/SymbolResult.svelte"],
    html: '<span class="badge type">C</span>',
    pairs: [{ name: "badge", ref: ".badge", lib: ".badge" }],
  },
  {
    id: "tree-line",
    sources: ["src/lib/terminal/TerminalPanel.svelte"],
    html: '<div style="display: flex; height: 24px"><span class="tree first"></span></div>',
    pairs: [
      { name: "line", ref: ".tree", lib: ".tree" },
      { name: "vertical", ref: ".tree", lib: ".tree", pseudo: "::before" },
      { name: "tick", ref: ".tree", lib: ".tree", pseudo: "::after" },
    ],
  },
];
