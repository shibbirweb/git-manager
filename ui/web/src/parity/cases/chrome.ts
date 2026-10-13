import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const FILL = { width: "fills its parent" };
const TEXT = { width: "follows its text" };

export const chromeCases: ParityCase[] = [
  {
    id: "op-banner",
    sources: ["src/lib/views/OpBanner.svelte"],
    html:
      `<div class="banner">${iconSvg("merge", 15)}<span class="text"><strong>Merging</strong> <span class="dim">` +
      '&middot; all conflicts resolved</span></span><div class="actions"></div></div>' +
      `<div class="banner has-conflicts">${iconSvg("alert", 15)}<span class="text"><strong>Merging</strong>` +
      '</span><div class="actions"></div></div>',
    pairs: [
      { name: "banner", ref: ".banner:not(.has-conflicts)", lib: ".notice.info", ignore: FILL },
      { name: "conflicts", ref: ".banner.has-conflicts", lib: ".notice.danger", ignore: FILL },
      { name: "icon", ref: ".banner:not(.has-conflicts) > svg", lib: ".notice.info > svg" },
      { name: "text", ref: ".banner:not(.has-conflicts) .text", lib: ".notice.info .message", ignore: FILL },
    ],
  },
  {
    id: "bisect-banner",
    sources: ["src/lib/views/git/BisectBanner.svelte"],
    html:
      `<div class="banner">${iconSvg("bug", 15)}<span class="text"><strong>Bisecting</strong></span>` +
      `<div class="actions"></div></div><div class="banner found">${iconSvg("bug", 15)}<span class="text">` +
      '<strong>Found it</strong></span><div class="actions"></div></div>',
    pairs: [
      { name: "banner", ref: ".banner:not(.found)", lib: ".notice.warning", ignore: FILL },
      { name: "found", ref: ".banner.found", lib: ".notice.success", ignore: FILL },
      {
        name: "text",
        ref: ".banner:not(.found) .text",
        lib: ".notice.warning .message",
        ignore: { ...FILL, "white-space": "set below", "text-overflow": "set below" },
      },
    ],
  },
  {
    id: "toast-action",
    sources: ["src/lib/ui/Toasts.svelte"],
    html:
      '<div class="toasts" style="position: static"><div class="toast warning"><div class="body">' +
      '<div class="title">Push rejected</div><pre class="detail selectable">Pull first.</pre></div>' +
      '<button class="btn small toast-action">Pull</button>' +
      `<button class="icon-btn close" aria-label="Dismiss">${iconSvg("x", 14)}</button></div></div>`,
    pairs: [
      { name: "toast", ref: ".toast", lib: ".toast", ignore: { width: "fits its text up to 420px" } },
      { name: "detail", ref: ".detail", lib: ".detail", ignore: { width: "follows the toast" } },
      { name: "action", ref: ".toast-action", lib: ".toast-action button", states: ["hover"] },
    ],
  },
  {
    id: "pick-groups",
    sources: ["src/lib/ui/DialogHost.svelte"],
    html:
      '<div class="pick-list" style="width: 420px"><div class="pick-group">Local</div>' +
      '<button class="pick-row"><span class="pick-label truncate">main</span></button></div>' +
      '<div class="pick-list" style="width: 420px"><div class="pick-empty dim">Nothing matches</div></div>',
    pairs: [
      { name: "group", ref: ".pick-group", lib: ".group", ignore: FILL },
      { name: "empty", ref: ".pick-empty", lib: ".empty", ignore: FILL },
    ],
  },
  {
    id: "header-history",
    sources: ["src/lib/views/Header.svelte"],
    html:
      '<header class="header"><div class="left"><div class="history"><button class="icon-btn history-btn" ' +
      `aria-label="Go back">${iconSvg("arrow-left", 15)}</button></div><button class="pill">` +
      `${iconSvg("folder-git", 14)}<span class="truncate">storefront</span><span class="repo-count dim">3</span>` +
      `${iconSvg("chevron-down", 12)}</button></div></header>`,
    pairs: [
      { name: "back", ref: ".history-btn", lib: ".icon-button", states: ["hover"] },
      {
        name: "picker",
        ref: ".pill",
        lib: ".start button.ghost",
        states: ["hover"],
        ignore: { ...TEXT, "white-space": "its name truncates and the count is one word, so nothing wraps" },
      },
      { name: "count", ref: ".repo-count", lib: ".count", ignore: { "white-space": "the button's; one word" } },
    ],
  },
  {
    id: "bell-head",
    sources: ["src/lib/notifications/NotificationBell.svelte"],
    html:
      '<div class="popup" style="position: static"><div class="head"><strong>Notifications</strong>' +
      '<label class="dnd"><input type="checkbox" /><span>Do Not Disturb</span></label>' +
      '<button class="btn small">Clear All</button></div></div>',
    pairs: [
      { name: "head", ref: ".head", lib: ".toolbar", ignore: FILL },
      {
        name: "dnd",
        ref: ".dnd",
        lib: ".check",
        ignore: TEXT,
        appBugs: { "rest:height": "the app's checkbox keeps the browser's margin, unlike its other checkboxes" },
      },
    ],
  },
  {
    id: "resize-handle-rows",
    sources: ["src/lib/ui/ResizeHandle.svelte"],
    html:
      '<div style="display: flex; flex-direction: column; width: 300px"><div class="handle horizontal" ' +
      'tabindex="0"></div></div>',
    pairs: [
      { name: "handle", ref: ".handle", lib: ".handle", ignore: { width: "the panel's width" } },
      {
        name: "line",
        ref: ".handle",
        lib: ".handle",
        pseudo: "::after",
        states: ["hover"],
        ignore: { width: "the panel's width" },
      },
    ],
  },
];
