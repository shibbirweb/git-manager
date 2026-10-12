import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

export const feedbackCases: ParityCase[] = [
  {
    id: "spinner",
    sources: ["src/lib/views/LogView.svelte"],
    html: '<span class="spinner"></span>',
    pairs: [{ name: "ring", ref: ".spinner", lib: ".spinner" }],
  },
  {
    id: "badge",
    sources: ["src/lib/views/ActivityBar.svelte"],
    html: '<span class="badge">4</span>',
    pairs: [{ name: "count", ref: ".badge", lib: ".badge" }],
  },
  {
    id: "tag",
    sources: ["src/lib/ai/AiPanel.svelte"],
    html: '<div style="display: flex"><span class="tag">primary</span></div>',
    pairs: [{ name: "tag", ref: ".tag", lib: ".tag" }],
  },
  {
    id: "kbd",
    sources: ["src/lib/help/ShortcutsDialog.svelte"],
    html: '<div style="display: flex"><kbd>⌘P</kbd></div>',
    pairs: [{ name: "key", ref: "kbd", lib: "kbd" }],
  },
  {
    id: "progress",
    sources: ["src/lib/views/StatusBar.svelte"],
    html: '<div class="bar" style="width: 268px"><div class="fill" style="width: 57%"></div></div>',
    pairs: [
      { name: "track", ref: ".bar", lib: ".bar", ignore: { width: "follows the parent's width" } },
      { name: "fill", ref: ".fill", lib: ".fill", ignore: { width: "a share of the parent's width" } },
    ],
  },
  {
    id: "notice",
    sources: ["src/lib/views/Welcome.svelte"],
    html: `<div class="notice">${iconSvg("alert")}<span>The folder could not be opened.</span></div>`,
    pairs: [
      { name: "banner", ref: ".notice", lib: ".notice" },
      { name: "icon", ref: ".notice svg", lib: ".notice svg" },
      { name: "message", ref: ".notice span", lib: ".message" },
    ],
  },
  {
    id: "empty-state",
    sources: ["src/lib/compare/FileCompareTab.svelte"],
    html:
      `<div class="placeholder" style="height: 160px">${iconSvg("alert", 18)}` +
      '<div>Could not compare the files</div><div class="dim">The file is missing.</div></div>',
    pairs: [
      {
        name: "box",
        ref: ".placeholder",
        lib: ".empty",
        ignore: { width: "fills the panel", height: "fills the panel" },
      },
      { name: "title", ref: ".placeholder > div:nth-of-type(1)", lib: ".title" },
      { name: "hint", ref: ".placeholder > .dim", lib: ".hint" },
    ],
  },
  {
    id: "empty-panel",
    sources: ["src/lib/ai/AiPanel.svelte"],
    html:
      `<div class="empty">${iconSvg("bot", 28, 1.5)}<strong>No folder open</strong>` +
      "<span>Open a folder to start AI agents in it.</span></div>" +
      '<div class="notice" style="margin: 0"><strong>No AI agents found</strong><span>Press Refresh.</span></div>',
    pairs: [
      { name: "panel", ref: ".empty", lib: ".empty.panel", ignore: { width: "fills the panel" } },
      { name: "icon", ref: ".empty svg", lib: ".empty.panel svg" },
      { name: "title", ref: ".empty strong", lib: ".empty.panel .title", ignore: { width: "a block in the library" } },
      { name: "text", ref: ".empty span", lib: ".empty.panel .hint", ignore: { width: "a block in the library" } },
      { name: "notice", ref: ".notice", lib: ".empty.notice", ignore: { width: "fills the panel" } },
    ],
  },
  {
    id: "card",
    sources: ["src/lib/ai/AiPanel.svelte"],
    html: '<div class="card" style="margin: 0"><div style="height: 40px"></div></div>',
    pairs: [{ name: "card", ref: ".card", lib: ".card", ignore: { height: "follows its rows" } }],
  },
  {
    id: "field",
    sources: ["src/lib/ui/DialogHost.svelte"],
    html:
      '<label class="field"><span>Name</span><input class="input" value="has space" /></label>' +
      '<div class="error">Branch names cannot contain spaces</div>',
    pairs: [
      {
        name: "field",
        ref: ".field",
        lib: ".field",
        ignore: { height: "the library keeps the error inside the field; the dialog puts it after" },
      },
      { name: "label", ref: ".field > span", lib: ".field > span:first-child" },
      { name: "error", ref: ".error", lib: ".error" },
    ],
  },
  {
    id: "toast",
    sources: ["src/lib/ui/Toasts.svelte"],
    html:
      '<div class="toasts" style="position: static"><div class="toast success"><div class="body">' +
      '<div class="title">Pushed to origin/main</div></div>' +
      `<button class="icon-btn close" aria-label="Dismiss">${iconSvg("x", 14)}</button></div></div>`,
    pairs: [
      { name: "toast", ref: ".toast", lib: ".toast", ignore: { width: "fits its text up to 420px" } },
      { name: "title", ref: ".title", lib: ".title", ignore: { width: "follows the toast" } },
      { name: "close", ref: ".close", lib: ".toast button", states: ["hover"] },
    ],
  },
];
