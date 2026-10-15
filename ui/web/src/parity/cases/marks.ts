import type { ParityCase } from "../types";

const FILL = { width: "fills its parent" };
const TEXT = { width: "follows its text" };

export const markCases: ParityCase[] = [
  {
    id: "choice-list",
    sources: ["src/lib/ui/DialogHost.svelte"],
    html:
      '<div class="choices"><button type="button" class="choice danger"><span class="choice-label">Drop</span>' +
      '<span class="dim">Delete it.</span></button></div>',
    pairs: [
      { name: "list", ref: ".choices", lib: ".choices", ignore: FILL },
      { name: "choice", ref: ".choice", lib: ".choice", states: ["hover"], ignore: FILL },
      { name: "label", ref: ".choice-label", lib: ".choice-label" },
    ],
  },
  {
    id: "status-dot",
    sources: ["src/lib/console/GitConsoleView.svelte"],
    html: '<span class="status success"></span>',
    pairs: [{ name: "dot", ref: ".status", lib: ".dot" }],
  },
  {
    id: "pill",
    sources: ["src/lib/views/files/FileView.svelte"],
    html: '<span class="badge unsaved">Unsaved</span>',
    pairs: [{ name: "pill", ref: ".badge", lib: ".pill" }],
  },
  {
    id: "meter",
    sources: ["src/lib/views/StatusBar.svelte"],
    html:
      '<div class="process"><div class="process-row"><span>Web content</span><span class="mono">181 MB</span>' +
      '</div><div class="bar"><div class="fill" style="width: 45%"></div></div></div>',
    pairs: [
      { name: "row", ref: ".process-row", lib: ".row", ignore: FILL },
      { name: "bar", ref: ".bar", lib: ".bar", ignore: FILL },
      { name: "fill", ref: ".fill", lib: ".fill", ignore: FILL },
    ],
  },
];
