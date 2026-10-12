import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const DIALOG = "src/lib/ui/DialogHost.svelte";

export const overlayCases: ParityCase[] = [
  {
    id: "dialog",
    sources: [DIALOG],
    html:
      '<div class="overlay" style="position: absolute; background: transparent"><div class="dialog"><form>' +
      '<h2>Discard all changes?</h2><p class="message">This cannot be undone.</p><div class="actions">' +
      '<button type="button" class="btn">Cancel</button><button class="btn primary">OK</button>' +
      "</div></form></div></div>",
    pairs: [
      {
        name: "dialog",
        ref: ".dialog",
        lib: ".dialog",
        ignore: { width: "min(460px, viewport): same rule", height: "follows the message, which the caller writes" },
      },
      { name: "title", ref: "h2", lib: "h2", ignore: { width: "follows the dialog" } },
      { name: "actions", ref: ".actions", lib: ".actions", ignore: { width: "follows the dialog" } },
    ],
  },
  {
    id: "menu",
    sources: ["src/lib/ui/ContextMenuHost.svelte"],
    html:
      '<div class="menu" style="position: absolute; left: 16px; top: 16px">' +
      '<button class="item highlighted"><span class="label">Open</span><span class="hint">⌘↓</span></button>' +
      '<button class="item"><span class="label">Rename...</span></button>' +
      '<div class="separator"></div>' +
      '<button class="item"><span class="label">Copy</span>' +
      `<span class="chevron">${iconSvg("chevron-right", 14)}</span></button>` +
      '<button class="item danger"><span class="label">Delete</span></button></div>',
    pairs: [
      { name: "menu", ref: ".menu", lib: ".menu" },
      { name: "highlighted", ref: ".item.highlighted", lib: ".item.highlighted" },
      { name: "item", ref: ".item:nth-child(2)", lib: ".item:nth-child(2)" },
      { name: "hint", ref: ".item.highlighted .hint", lib: ".item.highlighted .hint" },
      { name: "separator", ref: ".separator", lib: ".separator" },
      { name: "chevron", ref: ".chevron", lib: ".chevron" },
      { name: "danger", ref: ".item.danger", lib: ".item.danger" },
    ],
  },
  {
    id: "popover",
    sources: ["src/lib/ai/KeepAwake.svelte"],
    html:
      '<div class="awake" style="height: 220px; align-items: flex-end">' +
      '<div class="menu" style="bottom: auto; top: 0; right: auto; left: 0">Keep computer awake</div></div>',
    pairs: [{ name: "panel", ref: ".menu", lib: ".popover", ignore: { height: "follows its content" } }],
  },
];
