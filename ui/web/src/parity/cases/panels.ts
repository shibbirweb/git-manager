import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const FILL = { width: "fills its parent" };
const TEXT = { width: "follows its text" };

export const panelCases: ParityCase[] = [
  {
    id: "empty-main",
    sources: ["src/lib/views/EmptyMain.svelte"],
    html:
      `<div class="logo">${iconSvg("merge", 28)}</div><div class="actions"><button class="action">` +
      `${iconSvg("history", 15)}<span>Show the Log</span><kbd>⌘9</kbd></button></div>` +
      '<div class="nav-strip bottom">x</div>',
    pairs: [
      { name: "logo", ref: ".logo", lib: ".logo.soft" },
      { name: "strip", ref: ".nav-strip", lib: ".toolbar.strip", ignore: FILL },
    ],
  },
  {
    id: "rich-editor",
    sources: ["src/lib/views/files/RichMarkdownView.svelte"],
    html: '<div class="rich-markdown" style="height: 120px"><p class="notice">Read-only.</p></div>',
    pairs: [
      { name: "notice", ref: ".notice", lib: ".notice", ignore: FILL },
      { name: "page", ref: ".rich-markdown", lib: ".rich-markdown", ignore: { ...FILL, height: "fills the view" } },
    ],
  },
  {
    id: "floating-find",
    sources: ["src/lib/terminal/TerminalFindBar.svelte"],
    html:
      '<div style="position: relative; height: 60px"><div class="find-bar"><div class="field">' +
      `<span class="magnifier">${iconSvg("search", 13)}</span><input placeholder="Find" /></div>` +
      `<span class="counter">1 of 2</span><button class="icon">${iconSvg("x", 14)}</button></div></div>`,
    pairs: [
      { name: "bar", ref: ".find-bar", lib: ".find-bar", ignore: TEXT },
      { name: "field", ref: ".field", lib: ".field" },
      { name: "counter", ref: ".counter", lib: ".counter" },
      { name: "button", ref: ".icon", lib: ".icon:last-child", states: ["hover"] },
    ],
  },
];
