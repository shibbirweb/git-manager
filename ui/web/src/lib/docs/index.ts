// Every component's doc, in sidebar order. docs.test.ts checks that each component has exactly one.
import type { ComponentDoc } from "./types";
import { actionDocs } from "./actions";
import { agentDocs } from "./agents";
import { barDocs } from "./bars";
import { builderDocs } from "./builders";
import { changesDocs } from "./changes";
import { contentDocs } from "./content";
import { controlDocs } from "./controls";
import { editorDocs } from "./editor";
import { entryDocs } from "./entries";
import { feedbackDocs } from "./feedback";
import { formDocs } from "./forms";
import { largerDocs } from "./larger";
import { layoutDocs } from "./layout";
import { layoutPartDocs } from "./layouts";
import { listDocs } from "./lists";
import { markDocs } from "./marks";
import { navigationDocs } from "./navigation";
import { overlayDocs } from "./overlays";
import { panelDocs } from "./panels";
import { partDocs } from "./parts";
import { pickerDocs } from "./pickers";
import { pieceDocs } from "./pieces";
import { rowDocs } from "./rows";
import { sessionDocs } from "./sessions";
import { shellDocs } from "./shell";
import { surfaceDocs } from "./surfaces";
import { viewDocs } from "./views";
import { welcomeDocs } from "./welcome";

export const componentDocs: ComponentDoc[] = [
  ...actionDocs,
  ...formDocs,
  ...feedbackDocs,
  ...overlayDocs,
  ...navigationDocs,
  ...layoutDocs,
  ...builderDocs,
  ...shellDocs,
  ...editorDocs,
  ...rowDocs,
  ...contentDocs,
  ...partDocs,
  ...largerDocs,
  ...surfaceDocs,
  ...viewDocs,
  ...barDocs,
  ...markDocs,
  ...entryDocs,
  ...pieceDocs,
  ...welcomeDocs,
  ...controlDocs,
  ...sessionDocs,
  ...panelDocs,
  ...listDocs,
  ...changesDocs,
  ...agentDocs,
  ...layoutPartDocs,
  ...pickerDocs,
];

export function docFor(name: string): ComponentDoc | null {
  return componentDocs.find((doc) => doc.name === name) ?? null;
}
