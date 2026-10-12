import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const TEXT = { width: "follows its text" };

export const workspaceCases: ParityCase[] = [
  {
    id: "scripts-shelf",
    sources: ["src/lib/scripts/ScriptsPanel.svelte"],
    html:
      '<div class="tree"><div class="row script selected"><span class="name truncate">dev</span>' +
      `<span class="spacer"></span><button class="icon-btn run">${iconSvg("play", 12)}</button></div>` +
      '<div class="row"><span class="title truncate">sf</span><span class="runner dim">bun</span>' +
      '<button class="node-badge missing">Node 22</button></div></div>',
    pairs: [
      {
        name: "node badge",
        ref: ".node-badge",
        lib: ".chip.badge",
        ignore: { ...TEXT, "white-space": "the app's script row is nowrap" },
      },
    ],
  },
];
