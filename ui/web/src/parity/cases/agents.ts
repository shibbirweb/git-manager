import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const TEXT = { width: "follows its text" };
const FILL = { width: "fills its parent" };

export const agentCases: ParityCase[] = [
  {
    id: "askpass-prompt",
    sources: ["src/lib/askpass/AskpassDialog.svelte"],
    html: '<pre class="prompt selectable" style="width: 400px">Password for https://github.com:</pre>',
    pairs: [{ name: "prompt", ref: ".prompt", lib: ".block", ignore: FILL }],
  },
];
