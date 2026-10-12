import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const BOLD_STROKE = "the app's merge buttons draw 2.5; the design system has one bold stroke, 2.6";

export const surfaceCases: ParityCase[] = [
  {
    id: "format-toolbar",
    sources: ["src/lib/views/files/MarkdownToolbar.svelte"],
    html:
      '<div class="markdown-toolbar" role="toolbar"><div class="format">' +
      `<button class="tool">${iconSvg("bold", 14)}</button>` +
      `<button class="tool heading">${iconSvg("heading", 14)}${iconSvg("chevron-down", 10)}</button>` +
      '<span class="divider"></span>' +
      `<button class="tool">${iconSvg("quote", 14)}</button></div></div>`,
    pairs: [
      { name: "toolbar", ref: ".markdown-toolbar", lib: ".toolbar", ignore: { width: "fills its parent" } },
      { name: "group", ref: ".format", lib: ".format" },
      { name: "tool", ref: ".tool:not(.heading)", lib: ".tool:not([aria-haspopup])", states: ["hover"] },
      { name: "tool icon", ref: ".tool:not(.heading) svg", lib: ".tool:not([aria-haspopup]) svg" },
      { name: "menu tool", ref: ".tool.heading", lib: ".tool[aria-haspopup]" },
      { name: "chevron", ref: ".tool.heading svg + svg", lib: ".tool[aria-haspopup] svg + svg" },
      { name: "divider", ref: ".divider", lib: ".divider" },
    ],
  },
  {
    id: "merge-connector",
    sources: ["src/lib/merge/MergeEditor.svelte"],
    html:
      '<div class="connector" style="width: 52px; height: 60px"><svg width="52" height="100%">' +
      '<path class="ribbon conflict" d="M0 4C26 4 26 4 52 4L52 20C26 20 26 20 0 20Z"></path></svg>' +
      '<div class="buttons left" style="top: 5px">' +
      `<button class="chunk-btn apply conflict">${iconSvg("chevrons-right", 12, 2.5)}</button>` +
      `<button class="chunk-btn ignore">${iconSvg("x", 11, 2.5)}</button></div></div>`,
    pairs: [
      { name: "connector", ref: ".connector", lib: ".connector", ignore: { height: "the panes' height" } },
      { name: "ribbon", ref: ".ribbon", lib: ".ribbon", ignore: { width: "the path", height: "the path" } },
      { name: "buttons", ref: ".buttons", lib: ".buttons" },
      { name: "apply", ref: ".chunk-btn.apply", lib: ".chunk-btn.apply", states: ["hover"] },
      { name: "ignore", ref: ".chunk-btn.ignore", lib: ".chunk-btn.ignore", states: ["hover"] },
      {
        name: "apply icon",
        ref: ".chunk-btn.apply svg",
        lib: ".chunk-btn.apply svg",
        appBugs: { "rest:stroke-width": BOLD_STROKE },
      },
      {
        name: "ignore icon",
        ref: ".chunk-btn.ignore svg",
        lib: ".chunk-btn.ignore svg",
        appBugs: { "rest:stroke-width": BOLD_STROKE },
      },
    ],
  },
  {
    id: "merge-labels",
    sources: ["src/lib/merge/MergeEditor.svelte"],
    html:
      '<div class="labels"><div class="label ours">main</div><div class="label-gap"></div>' +
      '<div class="label result">Result <span class="dim">cart.ts</span></div><div class="label-gap"></div>' +
      '<div class="label theirs">feature/cart</div></div>',
    pairs: [
      { name: "labels", ref: ".labels", lib: ".labels" },
      { name: "ours", ref: ".label.ours", lib: ".label:first-child" },
      { name: "gap", ref: ".label-gap", lib: ".label-gap" },
      { name: "result", ref: ".label.result", lib: ".label.result" },
      { name: "file name", ref: ".label.result .dim", lib: ".label.result .file" },
      { name: "theirs", ref: ".label.theirs", lib: ".label.theirs" },
    ],
  },
];
