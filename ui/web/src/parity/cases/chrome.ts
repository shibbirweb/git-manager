import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const FILL = { width: "fills its parent" };
const TEXT = { width: "follows its text" };

export const chromeCases: ParityCase[] = [
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
];
