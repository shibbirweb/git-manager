import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const FILL = { width: "fills its parent" };
const TEXT = { width: "follows its text" };
const STRUCTURE = {
  "padding-left": "the app's icon sits over the input; the library lays it out in a row",
  "padding-right": "the app's clear button sits over the input; the library lays it out in a row",
};

export const settingsCases: ParityCase[] = [
  {
    id: "settings-parts",
    sources: ["src/lib/views/SettingsDialog.svelte"],
    html:
      '<div class="content"><div class="group-title">Editor</div><pre class="font-preview">let a = 1;</pre>' +
      '<ul class="changed"><li>theme: dark</li></ul><div class="about"><div class="about-logo">' +
      `${iconSvg("merge", 26)}</div><div class="about-name">Git Manager</div></div>` +
      `<div class="link-list"><button class="link-row">${iconSvg("book", 16)}<span><strong>Docs</strong>` +
      '<span class="dim">The wiki.</span></span></button></div><div class="range"><span class="value weight-value">' +
      "Regular</span></div></div>",
    pairs: [
      { name: "group title", ref: ".group-title", lib: ".section-title.group", ignore: FILL },
      { name: "font sample", ref: ".font-preview", lib: ".sample", ignore: FILL },
      { name: "changed list", ref: ".changed", lib: ".list", ignore: FILL },
      { name: "about logo", ref: ".about-logo", lib: ".logo.medium" },
      { name: "link card", ref: ".link-row", lib: ".resource.card", states: ["hover"], ignore: FILL },
      { name: "wide value", ref: ".weight-value", lib: ".value.wide" },
    ],
  },
  {
    id: "settings-content-head",
    sources: ["src/lib/views/SettingsDialog.svelte"],
    html: '<div class="content-head"><h3>Editor</h3></div>',
    pairs: [{ name: "head", ref: ".content-head", lib: ".head.content", ignore: FILL }],
  },
  {
    id: "panel-filter",
    sources: ["src/lib/views/Sidebar.svelte"],
    html:
      `<div class="filter"><span class="filter-icon">${iconSvg("search", 13)}</span>` +
      '<input class="input filter-input" placeholder="Filter" /></div>',
    pairs: [
      { name: "bar", ref: ".filter", lib: ".toolbar.search", ignore: FILL },
      {
        name: "field",
        ref: ".filter-input",
        lib: ".search.compact",
        ignore: { ...FILL, ...STRUCTURE, "column-gap": STRUCTURE["padding-left"], cursor: "an input's cursor" },
      },
    ],
  },
  {
    id: "console-filter",
    sources: ["src/lib/console/GitConsoleView.svelte"],
    html: `<div class="filter">${iconSvg("search", 13)}<input class="filter-input" placeholder="Filter" /></div>`,
    pairs: [{ name: "field", ref: ".filter", lib: ".search.small" }],
  },
  {
    id: "status-items",
    sources: ["src/lib/views/StatusBar.svelte"],
    html:
      '<footer class="status-bar"><div class="left"><button class="item branch">' +
      '<span class="branch-name">feature/a-long-branch-name</span></button>' +
      '<button class="item update">0.2.0</button></div></footer>',
    pairs: [
      { name: "branch", ref: ".item.branch", lib: ".item:first-child", ignore: TEXT },
      { name: "branch name", ref: ".branch-name", lib: ".text.branch", ignore: TEXT },
      { name: "update", ref: ".item.update", lib: ".item.accent", ignore: TEXT },
    ],
  },
];
