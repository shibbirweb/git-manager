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
    id: "link-avatar",
    sources: ["src/lib/views/github/GitHubSignInForm.svelte"],
    html: '<span class="avatar">AL</span><button class="link">Create a token</button>',
    pairs: [
      { name: "avatar", ref: ".avatar", lib: ".avatar" },
      { name: "link", ref: ".link", lib: ".link", states: ["hover"] },
    ],
  },
  {
    id: "chip-pill-mark",
    sources: ["src/lib/ai/AiPanel.svelte"],
    html: '<button class="pill waiting">2 waiting</button><span class="badge">CC</span>',
    pairs: [
      { name: "chip", ref: ".pill", lib: ".chip", ignore: TEXT },
      { name: "mark", ref: ".badge", lib: ".mark" },
    ],
  },
  {
    id: "font-chip",
    sources: ["src/lib/views/SettingsDialog.svelte"],
    html: '<button class="font-pick">Menlo</button>',
    pairs: [{ name: "chip", ref: ".font-pick", lib: ".chip", states: ["hover"], ignore: TEXT }],
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
  {
    id: "zoom-badge",
    sources: ["src/lib/App.svelte"],
    html: '<div class="zoom-badge">110%</div>',
    pairs: [{ name: "badge", ref: ".zoom-badge", lib: ".zoom-badge" }],
  },
];
