// Every parity case, for the page (ParityPage.svelte) and the runner (scripts/parity.ts).
import { agentCases } from "./cases/agents";
import { atomCases } from "./cases/atoms";
import { barCases } from "./cases/bars";
import { basicCases } from "./cases/basic";
import { blockCases } from "./cases/blocks";
import { builderCases } from "./cases/builders";
import { chromeCases } from "./cases/chrome";
import { controlCases } from "./cases/controls";
import { dialogCases } from "./cases/dialogs";
import { feedbackCases } from "./cases/feedback";
import { finishCases } from "./cases/finish";
import { historyCases } from "./cases/history";
import { largerCases } from "./cases/larger";
import { listCases } from "./cases/lists";
import { markCases } from "./cases/marks";
import { navigationCases } from "./cases/navigation";
import { overlayCases } from "./cases/overlays";
import { panelCases } from "./cases/panels";
import { pickerCases } from "./cases/pickers";
import { pieceCases } from "./cases/pieces";
import { rowCases } from "./cases/rows";
import { searchCases } from "./cases/search";
import { settingsCases } from "./cases/settings";
import { shellCases } from "./cases/shell";
import { stateCases } from "./cases/states";
import { statusCases } from "./cases/status";
import { surfaceCases } from "./cases/surfaces";
import { tabCases } from "./cases/tabs";
import { variantCases } from "./cases/variants";
import { workspaceCases } from "./cases/workspace";
import type { ParityCase } from "./types";

export const parityCases: ParityCase[] = [
  ...basicCases,
  ...feedbackCases,
  ...overlayCases,
  ...navigationCases,
  ...shellCases,
  ...blockCases,
  ...largerCases,
  ...surfaceCases,
  ...rowCases,
  ...builderCases,
  ...barCases,
  ...markCases,
  ...pieceCases,
  ...controlCases,
  ...variantCases,
  ...panelCases,
  ...listCases,
  ...workspaceCases,
  ...settingsCases,
  ...pickerCases,
  ...chromeCases,
  ...tabCases,
  ...stateCases,
  ...atomCases,
  ...statusCases,
  ...historyCases,
  ...searchCases,
  ...dialogCases,
  ...agentCases,
  ...finishCases,
];
