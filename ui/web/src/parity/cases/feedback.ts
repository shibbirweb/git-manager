import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

export const feedbackCases: ParityCase[] = [
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
];
