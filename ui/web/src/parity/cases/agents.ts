import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const TEXT = { width: "follows its text" };
const FILL = { width: "fills its parent" };

export const agentCases: ParityCase[] = [
  {
    id: "ai-panel-bits",
    sources: ["src/lib/ai/AiPanel.svelte"],
    html:
      '<div class="list" style="width: 300px"><div class="folder-heading truncate">storefront</div></div>' +
      `<button class="icon-btn hover-action" style="visibility: visible">${iconSvg("plus", 13)}</button>` +
      '<span class="tag warn">missing</span>',
    pairs: [
      {
        name: "heading",
        ref: ".folder-heading",
        lib: ".section-title",
        ignore: { ...FILL, "white-space": "its title inside does not wrap" },
      },
      {
        name: "hover action",
        ref: ".hover-action",
        lib: ".icon-button",
        states: ["hover"],
        appBugs: Object.fromEntries(
          ["color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color"].map(
            (name) => [`hover:${name}`, "the AI panel's row actions stay dim on hover; other dim buttons brighten"],
          ),
        ),
      },
      { name: "warn tag", ref: ".tag.warn", lib: ".tag", ignore: TEXT },
    ],
  },
  {
    id: "askpass-prompt",
    sources: ["src/lib/askpass/AskpassDialog.svelte"],
    html: '<pre class="prompt selectable" style="width: 400px">Password for https://github.com:</pre>',
    pairs: [{ name: "prompt", ref: ".prompt", lib: ".block", ignore: FILL }],
  },
  {
    id: "new-task-bits",
    sources: ["src/lib/ai/NewTaskDialog.svelte"],
    html:
      `<button type="button" class="btn small add-agent">${iconSvg("plus", 12)} Add Agent to Race</button>` +
      `<span class="target dim truncate">${iconSvg("branch", 11)}cart</span>`,
    pairs: [
      {
        name: "add agent",
        ref: ".add-agent",
        lib: ".button",
        states: ["hover"],
        ignore: { ...TEXT, "column-gap": "drift: 4px here, a small Button is 6px" },
      },
      {
        name: "target",
        ref: ".target",
        lib: '[aria-label="Target"] .text',
        ignore: {
          ...TEXT,
          height: "the app's row is the text",
          "white-space": "Text truncate",
          "column-gap": "the Stack around it sets the gap",
        },
      },
    ],
  },
];
