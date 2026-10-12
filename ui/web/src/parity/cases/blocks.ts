import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const SWATCH =
  "--sw-bg: #272822; --sw-fg: #f8f8f2; --sw-keyword: #f92672; --sw-string: #e6db74; --sw-selection: #49483e; " +
  "--sw-accent: #a6e22e; --sw-border: #3e3d32";

export const blockCases: ParityCase[] = [
  {
    id: "panel-header",
    sources: ["src/lib/views/PanelHead.svelte"],
    html:
      '<div class="head"><span class="title">Changes</span><span class="spacer"></span>' +
      `<button class="icon-btn small">${iconSvg("refresh", 13)}</button></div>`,
    pairs: [
      { name: "head", ref: ".head", lib: ".head", ignore: { width: "fills the panel" } },
      { name: "title", ref: ".title", lib: ".title" },
    ],
  },
  {
    id: "file-row",
    sources: ["src/lib/views/changes/FileRow.svelte"],
    html:
      '<div class="row selected"><span class="letter kind-modified">M</span>' +
      '<span class="text truncate"><span class="name">cart.ts</span><span class="directory">src/lib</span></span>' +
      '<span class="tag">LFS</span></div>' +
      '<div class="row"><span class="letter kind-untracked">U</span><span class="text truncate">' +
      '<span class="name deleted">old.ts</span></span></div>',
    pairs: [
      { name: "row", ref: ".row.selected", lib: ".row.selected", ignore: { width: "fills the list" } },
      { name: "letter", ref: ".kind-modified", lib: ".kind-modified" },
      { name: "untracked letter", ref: ".kind-untracked", lib: ".kind-untracked" },
      { name: "name", ref: ".row.selected .name", lib: ".row.selected .name" },
      { name: "deleted name", ref: ".name.deleted", lib: ".name.deleted" },
      { name: "folder", ref: ".directory", lib: ".directory" },
      { name: "tag", ref: ".tag", lib: ".tag" },
    ],
  },
  {
    id: "description-list",
    sources: ["src/lib/log/CommitDetails.svelte"],
    html: '<dl class="meta" style="margin: 0"><dt>Author</dt><dd>Ada</dd><dt>Date</dt><dd>11 Oct 2026</dd></dl>',
    pairs: [
      { name: "list", ref: ".meta", lib: ".meta", ignore: { width: "fills the details" } },
      { name: "label", ref: "dt", lib: "dt" },
      { name: "value", ref: "dd", lib: "dd", ignore: { width: "fills the column" } },
    ],
  },
  {
    id: "code-block",
    sources: ["src/lib/console/GitConsoleView.svelte"],
    html: '<div class="output" style="margin: 0"><pre class="block">$ git fetch origin</pre></div>',
    pairs: [
      {
        name: "output box",
        ref: ".output",
        lib: ".block.output",
        ignore: {
          width: "fills the console",
          height: "follows the text",
          "font-family": "the app sets the text on the pre inside (compared below)",
          "font-size": "the app sets the text on the pre inside",
          "line-height": "the app sets the text on the pre inside",
          "white-space": "the app sets the text on the pre inside",
        },
      },
      {
        name: "output text",
        ref: ".block",
        lib: ".block.output",
        ignore: Object.fromEntries(
          ["width", "height", "padding-top", "padding-right", "padding-bottom", "padding-left", "background-color"]
            .concat(["border-left-width", "border-left-style", "border-top-style", "border-left-color"])
            .map((property) => [property, "the app draws the box on the outer div (compared above)"]),
        ),
      },
    ],
  },
  {
    id: "highlight",
    sources: ["src/lib/quickOpen/QuickOpen.svelte", "src/lib/search/TextResult.svelte"],
    html: "<span>src/<b>repo</b>.ts</span> <span>const <mark>total</mark></span>",
    pairs: [
      { name: "strong", ref: "b", lib: "b" },
      { name: "mark", ref: "mark", lib: "mark" },
    ],
  },
  {
    id: "side-nav",
    sources: ["src/lib/views/SettingsDialog.svelte"],
    html:
      '<nav style="display: flex; flex-direction: column; gap: 2px; width: 170px">' +
      '<button class="nav-item">Appearance</button><button class="nav-item active">Editor</button>' +
      '<button class="nav-item reset">Reset All Settings...</button></nav>',
    pairs: [
      {
        name: "item",
        ref: ".nav-item:not(.active):not(.reset)",
        lib: ".nav-item:not(.active):not(.danger)",
        states: ["hover"],
        ignore: { width: "fills the nav" },
      },
      { name: "active", ref: ".nav-item.active", lib: ".nav-item.active", ignore: { width: "fills the nav" } },
      { name: "reset", ref: ".nav-item.reset", lib: ".nav-item.danger", ignore: { width: "fills the nav" } },
    ],
  },
  {
    id: "split-button",
    sources: ["src/lib/views/changes/CommitBox.svelte"],
    html:
      '<span class="split"><button class="btn primary main">Commit</button>' +
      `<button class="btn primary chevron">${iconSvg("chevron-down", 13)}</button></span>`,
    pairs: [
      { name: "main", ref: ".main", lib: ".main button" },
      { name: "arrow", ref: ".chevron", lib: ".arrow button" },
    ],
  },
  {
    id: "status-icon",
    sources: ["src/lib/ai/AgentStateIcon.svelte"],
    html:
      '<span class="mark working"><span class="spinner"></span></span>' +
      '<span class="mark waiting"><span class="question">?</span></span>' +
      '<span class="mark idle"><span class="ring"></span></span>',
    pairs: [
      { name: "mark", ref: ".mark.working", lib: ".mark.working" },
      { name: "spinner", ref: ".spinner", lib: ".spinner" },
      { name: "question", ref: ".question", lib: ".question" },
      { name: "ring", ref: ".ring", lib: ".ring" },
    ],
  },
  {
    id: "ref-label",
    sources: ["src/lib/views/LogView.svelte"],
    html:
      '<div style="--row-bg: var(--panel)"><span class="ref ref-head">main</span>' +
      '<span class="ref ref-local">feature</span><span class="ref ref-remote">origin/main</span>' +
      '<span class="ref ref-tag">v1.0</span></div>',
    pairs: [
      { name: "head", ref: ".ref-head", lib: ".ref.head" },
      { name: "local", ref: ".ref-local", lib: ".ref.local" },
      { name: "remote", ref: ".ref-remote", lib: ".ref.remote" },
      { name: "tag", ref: ".ref-tag", lib: ".ref.tag" },
    ],
  },
  {
    id: "loading-overlay",
    sources: ["src/lib/views/OpeningProgress.svelte"],
    html:
      '<div class="backdrop" style="position: absolute"><div class="card"><span class="spinner"></span>' +
      '<div class="text"><span class="title">Opening storefront</span><span class="step">Reading</span>' +
      '<span class="hint">A moment.</span></div></div></div>',
    pairs: [
      { name: "card", ref: ".card", lib: ".card" },
      { name: "spinner", ref: ".spinner", lib: ".spinner" },
      { name: "title", ref: ".title", lib: ".title" },
      { name: "step", ref: ".step", lib: ".step" },
      { name: "hint", ref: ".hint", lib: ".hint" },
    ],
  },
  {
    id: "theme-swatch",
    sources: ["src/lib/views/settings/ColorThemePicker.svelte"],
    html:
      `<span class="swatch" style="${SWATCH}"><span class="sample"><span class="kw">fn</span> ` +
      '<span class="sel">Aa</span></span><span class="bars"><span class="bar keyword"></span>' +
      '<span class="bar string"></span><span class="bar accent"></span></span></span>',
    pairs: [
      { name: "swatch", ref: ".swatch", lib: ".swatch" },
      { name: "keyword bar", ref: ".bar.keyword", lib: ".bar.keyword" },
      { name: "sample", ref: ".sample", lib: ".sample" },
    ],
  },
];
