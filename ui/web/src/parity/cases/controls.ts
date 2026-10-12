import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const FILL = { width: "fills its parent" };
const TEXT = { width: "follows its text" };

export const controlCases: ParityCase[] = [
  {
    id: "choice-menu",
    sources: ["src/lib/ai/KeepAwake.svelte"],
    html:
      '<div class="menu" style="position: static"><div class="menu-head"><span>Keep Awake</span>' +
      '<span class="dim">Off</span></div><div class="separator"></div><button class="choice">' +
      '<span class="radio"><span class="radio-dot"></span></span><span class="choice-text"><span>Off</span>' +
      '<span class="description">Sleep as usual.</span></span></button></div>',
    pairs: [
      { name: "head", ref: ".menu-head", lib: ".head", ignore: FILL },
      { name: "separator", ref: ".separator", lib: ".separator", ignore: FILL },
      { name: "choice", ref: ".choice", lib: ".choice", states: ["hover"], ignore: FILL },
      { name: "radio", ref: ".radio", lib: ".radio" },
      { name: "dot", ref: ".radio-dot", lib: ".radio-dot" },
      { name: "description", ref: ".description", lib: ".description" },
    ],
  },
  {
    id: "dialog-head",
    sources: ["src/lib/askpass/AskpassDialog.svelte"],
    html:
      `<div class="head"><span class="badge">${iconSvg("lock", 15)}</span><div class="head-text">` +
      "<h2>Password</h2><p class=\"dim\">git asks for this.</p></div></div>",
    pairs: [
      { name: "head", ref: ".head", lib: ".head", ignore: FILL },
      { name: "icon tile", ref: ".badge", lib: ".icon-tile" },
      { name: "subtitle", ref: ".head-text p", lib: ".subtitle", ignore: FILL },
    ],
  },
  {
    id: "panel-dialog-head",
    sources: ["src/lib/update/UpdateDialog.svelte"],
    html: `<div class="head"><div class="badge">${iconSvg("cloud-download", 18)}</div><div><h2>Update</h2></div></div>`,
    pairs: [
      { name: "head", ref: ".head", lib: ".head", ignore: FILL },
      { name: "icon tile", ref: ".badge", lib: ".icon-tile" },
    ],
  },
  {
    id: "zoom-bar",
    sources: ["src/lib/views/files/MediaPreview.svelte"],
    html:
      `<div class="bar"><button class="btn small icon-only">${iconSvg("minus", 13)}</button>` +
      '<span class="zoom">42%</span><button class="btn small on">Fit</button></div>' +
      '<div class="canvas" style="height: 80px"></div>',
    pairs: [
      { name: "bar", ref: ".bar", lib: ".bar", ignore: FILL },
      { name: "icon button", ref: ".btn.icon-only", lib: ".button.icon-only", states: ["hover"] },
      { name: "zoom", ref: ".zoom", lib: ".zoom" },
      { name: "pressed", ref: ".btn.on", lib: ".button.on", ignore: TEXT },
      { name: "canvas", ref: ".canvas", lib: ".canvas", ignore: { ...FILL, height: "fills the view" } },
    ],
  },
  {
    id: "media-compare",
    sources: ["src/lib/diff/BinaryPreview.svelte"],
    html:
      '<div class="sides"><div class="side"><div class="head"><span class="label truncate">HEAD</span>' +
      '<span class="info">9 KB</span></div></div><div class="side"><div class="head">' +
      '<span class="label truncate">Working tree</span></div></div></div>',
    pairs: [
      { name: "head", ref: ".side .head", lib: ".side .head", ignore: FILL },
      { name: "info", ref: ".info", lib: ".info" },
      { name: "second side", ref: ".side + .side", lib: ".side + .side", ignore: { ...FILL, height: "fills" } },
    ],
  },
  {
    id: "session-tabs",
    sources: ["src/lib/terminal/RunView.svelte"],
    html:
      '<div class="sessions"><div class="session selected"><span class="state ok">' +
      `${iconSvg("check", 11)}</span><span class="name truncate">bun run test</span>` +
      `<button class="close">${iconSvg("x", 11)}</button></div></div>`,
    pairs: [
      { name: "strip", ref: ".sessions", lib: ".sessions", ignore: FILL },
      { name: "session", ref: ".session", lib: ".session", states: ["hover"], ignore: TEXT },
      { name: "state", ref: ".state", lib: ".state" },
      { name: "close", ref: ".close", lib: ".close", states: ["hover"] },
    ],
  },
];
