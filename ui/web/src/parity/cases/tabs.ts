import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const FILL = { width: "fills its parent" };
const TEXT = { width: "follows its text" };
const TABS = "src/lib/views/EditorTabs.svelte";
const PANEL = "src/lib/terminal/TerminalPanel.svelte";

const tab = (classes: string, name: string, close: "x" | "pin" = "x", hint = "") =>
  `<div class="tab ${classes}"><button class="tab-main">${iconSvg("file", 13)}<span class="name">${name}</span>` +
  `${hint ? `<span class="hint">${hint}</span>` : ""}</button><button class="tab-close">` +
  `<span class="dot"></span><span class="x">${iconSvg(close, 12)}</span></button></div>`;

export const tabCases: ParityCase[] = [
  {
    id: "tabs-wrap",
    sources: [TABS],
    html: `<div class="tab-strip wrap" style="width: 300px">${tab("active", "cart.ts")}${tab("", "tax.ts")}</div>`,
    pairs: [
      { name: "strip", ref: ".tab-strip", lib: ".tab-strip", ignore: FILL },
      { name: "tab", ref: ".tab:not(.active)", lib: ".tab:not(.active)", ignore: TEXT },
    ],
  },
  {
    id: "tabs-single",
    sources: [TABS],
    html: `<div class="tab-strip single" style="width: 400px">${tab("active", "cart.ts")}</div>`,
    pairs: [
      { name: "strip", ref: ".tab-strip", lib: ".tab-strip", ignore: FILL },
      { name: "tab", ref: ".tab", lib: ".tab", ignore: TEXT },
      { name: "frame", ref: ".tab", lib: ".tab", pseudo: "::before" },
      { name: "main", ref: ".tab-main", lib: ".tab-main", ignore: TEXT },
      { name: "name", ref: ".name", lib: ".name", ignore: TEXT },
      { name: "x", ref: ".x", lib: ".x" },
    ],
  },
  {
    id: "tabs-unfocused",
    sources: [TABS],
    html: `<div class="tab-strip unfocused">${tab("active", "cart.ts")}${tab("pinned", "tax.ts", "pin")}</div>`,
    pairs: [
      { name: "active", ref: ".tab.active", lib: ".tab.active", ignore: TEXT },
      { name: "line", ref: ".tab.active", lib: ".tab.active", pseudo: "::before" },
      { name: "pinned x", ref: ".tab.pinned .x", lib: ".tab.pinned .x" },
    ],
  },
  {
    id: "tab-lifted",
    sources: [TABS],
    html: `<div class="tab-strip">${tab("lifted", "cart.ts")}</div>`,
    pairs: [{ name: "tab", ref: ".tab.lifted", lib: ".tab.lifted", ignore: { ...TEXT, height: "the strip sets it" } }],
  },
  {
    id: "new-tab",
    sources: [TABS],
    html:
      `<div class="tab-strip">${tab("active", "cart.ts")}` +
      `<button class="new-tab">${iconSvg("plus", 14)}</button></div>`,
    pairs: [{ name: "button", ref: ".new-tab", lib: ".new-tab", states: ["hover"] }],
  },
  {
    id: "terminal-head",
    sources: [PANEL],
    html:
      '<header class="head"><span class="single"><span class="name truncate">zsh</span>' +
      '<span class="folder truncate">storefront</span></span><div class="spacer"></div><div class="new">' +
      `<button class="icon-btn small">${iconSvg("plus", 15)}</button><button class="icon-btn small chevron">` +
      `${iconSvg("chevron-down", 12)}</button></div><span class="divider"></span></header>`,
    pairs: [
      { name: "single", ref: ".single", lib: ".stack", ignore: TEXT },
      { name: "folder", ref: ".single .folder", lib: ".stack .text:last-child", ignore: TEXT },
      { name: "chevron", ref: ".chevron", lib: ".icon-button.chevron", states: ["hover"] },
      { name: "divider", ref: ".divider", lib: ".divider" },
    ],
  },
  {
    id: "run-tools",
    sources: ["src/lib/terminal/RunView.svelte"],
    html:
      `<div class="tools"><button class="icon-btn small rerun">${iconSvg("refresh", 14)}</button>` +
      `<button class="icon-btn small stop">${iconSvg("stop", 14)}</button></div>`,
    pairs: [
      { name: "rerun", ref: ".rerun", lib: ".icon-button.success", states: ["hover"] },
      { name: "stop", ref: ".stop", lib: ".icon-button.danger", states: ["hover"] },
    ],
  },
];
