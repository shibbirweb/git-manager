import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const FILL = { width: "fills its parent" };
const TEXT = { width: "follows its text" };
const INLINE = { height: "inline in the reference; the same height in a row" };

export const variantCases: ParityCase[] = [
  {
    id: "palette-command",
    sources: ["src/lib/quickOpen/QuickOpen.svelte"],
    html:
      '<div class="row disabled" style="position: relative; top: 0"><span class="title"><span class="category">' +
      'Git:</span> Push</span><span class="reason">No repository</span></div>' +
      `<div class="row" style="position: relative; top: 0"><span class="title">Wrap</span><span class="check">` +
      `${iconSvg("check", 13)}</span></div>`,
    pairs: [
      { name: "category", ref: ".category", lib: ".category" },
      { name: "reason", ref: ".reason", lib: ".reason", ignore: TEXT },
      { name: "check", ref: ".check", lib: ".check" },
    ],
  },
  {
    id: "recent-head",
    sources: ["src/lib/recentFiles/RecentFiles.svelte"],
    html:
      '<div class="head"><span class="title">Recent Files</span><button class="toggle on">' +
      `${iconSvg("check", 12)}Edited only</button></div><div class="row"><span class="dirty"></span></div>`,
    pairs: [
      { name: "toggle", ref: ".toggle", lib: ".toggle.chip", states: ["hover"], ignore: TEXT },
      { name: "dirty", ref: ".dirty", lib: ".dirty" },
    ],
  },
  {
    id: "small-badge",
    sources: ["src/lib/notifications/NotificationBell.svelte"],
    html: '<span class="badge">3</span>',
    pairs: [{ name: "badge", ref: ".badge", lib: ".badge.small", ignore: TEXT }],
  },
  {
    id: "file-bar",
    sources: ["src/lib/views/files/FileView.svelte"],
    html:
      '<div class="file-bar"><span class="divider"></span>' +
      `<button class="tool on">${iconSvg("history", 13)}</button>` +
      `<div class="modes"><button class="on">${iconSvg("split-view", 13)}</button></div></div>` +
      `<div class="conflict-bar"><span class="conflict-icon">${iconSvg("alert", 13)}</span></div>`,
    pairs: [
      { name: "bar", ref: ".file-bar", lib: ".toolbar.file", ignore: FILL },
      { name: "divider", ref: ".divider", lib: ".toolbar.file .divider" },
      { name: "tool on", ref: ".tool.on", lib: ".toggle.tool", states: ["hover"] },
      { name: "modes", ref: ".modes", lib: ".segmented.small" },
      { name: "mode on", ref: ".modes button.on", lib: ".segmented.small button.on" },
      { name: "conflict bar", ref: ".conflict-bar", lib: ".toolbar.conflict", ignore: FILL },
    ],
  },
];
