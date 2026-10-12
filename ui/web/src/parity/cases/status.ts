import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const TEXT = { width: "follows its text" };

export const statusCases: ParityCase[] = [
  {
    id: "ai-usage-item",
    sources: ["src/lib/ai/AiUsage.svelte"],
    html:
      '<div class="usage"><button class="usage-item warn"><span class="bar"><span class="fill" style="width: 80%">' +
      '</span></span><span class="text">80% used</span></button></div>',
    pairs: [
      { name: "item", ref: ".usage-item", lib: ".item", states: ["hover"], ignore: TEXT },
      { name: "bar", ref: ".bar", lib: ".meter .bar" },
      { name: "text", ref: ".text", lib: ".item > .text", ignore: TEXT },
    ],
  },
  {
    id: "keep-awake",
    sources: ["src/lib/ai/KeepAwake.svelte"],
    html: `<button class="awake-button active">${iconSvg("coffee", 12)}Awake</button>`,
    pairs: [
      {
        name: "button",
        ref: ".awake-button",
        lib: ".item",
        states: ["hover"],
        ignore: { ...TEXT, "white-space": "one icon and one word" },
      },
    ],
  },
  {
    id: "status-details",
    sources: ["src/lib/views/StatusBar.svelte"],
    html:
      '<div class="memory" style="position: static"><div class="details" style="position: static">' +
      '<div class="details-head"><span>Memory</span><span>126 MB</span></div><div class="gpu">' +
      '<span class="gpu-title">GPU</span><p class="gpu-note">Shared with the system.</p></div></div></div>',
    pairs: [
      { name: "popup", ref: ".details", lib: ".popover", ignore: { height: "holds different parts" } },
      {
        name: "gpu",
        ref: ".gpu",
        lib: '[aria-label="GPU"]',
        ignore: {
          height: "holds different parts",
          "padding-top": "a Divider above it draws the line and the space",
          "border-top-width": "a Divider above it draws the line",
          "border-top-style": "a Divider above it draws the line",
          "border-top-color": "a Divider above it draws the line",
        },
      },
      { name: "gpu title", ref: ".gpu-title", lib: '[aria-label="GPU"] > :first-child', ignore: TEXT },
      { name: "gpu note", ref: ".gpu-note", lib: '[aria-label="GPU"] > :last-child', ignore: { width: "fills" } },
    ],
  },
  {
    id: "status-states",
    sources: ["src/lib/views/StatusBar.svelte"],
    html:
      '<footer class="status-bar"><button class="item fetch-hint">Fetch</button>' +
      `<button class="item spinning" disabled>${iconSvg("sync", 12)}<span>2↓</span></button></footer>`,
    pairs: [
      { name: "hint", ref: ".fetch-hint", lib: ".item.warning", ignore: TEXT },
      { name: "spinning", ref: ".spinning", lib: ".item:disabled", ignore: TEXT },
    ],
  },
];
