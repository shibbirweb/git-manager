// Every parity case, for the page (ParityPage.svelte) and the runner (scripts/parity.ts).
import { basicCases } from "./cases/basic";
import { feedbackCases } from "./cases/feedback";
import { navigationCases } from "./cases/navigation";
import { overlayCases } from "./cases/overlays";
import { shellCases } from "./cases/shell";
import type { ParityCase } from "./types";

export const parityCases: ParityCase[] = [
  ...basicCases,
  ...feedbackCases,
  ...overlayCases,
  ...navigationCases,
  ...shellCases,
];
