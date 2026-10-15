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
