import type { ParityCase } from "../types";

const FILL = { width: "fills its parent" };

export const listCases: ParityCase[] = [
  {
    id: "remotes",
    sources: ["src/lib/views/git/RemotesDialog.svelte"],
    html:
      '<div class="remotes"><div class="remote"><div class="info"><span class="name">origin</span>' +
      '<span class="url">git@x:y.git</span></div></div></div>',
    pairs: [
      { name: "box", ref: ".remotes", lib: ".list-box", ignore: { ...FILL, height: "follows its rows" } },
    ],
  },
  {
    id: "local-history",
    sources: ["src/lib/localHistory/LocalHistoryDialog.svelte"],
    html:
      '<div class="versions" style="height: 200px"><button class="version selected"><span class="time">10:42</span>' +
      '<span class="label safety">Before reset</span></button></div>' +
      '<button class="deleted-row"><span class="name">tax.ts</span><span class="dim folder">src</span>' +
      '<span class="dim when">2d</span></button>',
    pairs: [
      { name: "pane", ref: ".versions", lib: ".pane", ignore: { height: "follows its rows" } },
    ],
  },
  {
    id: "release-notes",
    sources: ["src/lib/update/ReleaseNotes.svelte"],
    html: '<div class="notes"><h3>Added</h3><p>A <code>ui</code> library.</p></div>',
    pairs: [
      { name: "notes", ref: ".notes", lib: ".md-notes", ignore: { ...FILL, height: "follows its text" } },
      { name: "heading", ref: "h3", lib: "h3", ignore: FILL },
      { name: "code", ref: "code", lib: "code" },
    ],
  },
];
