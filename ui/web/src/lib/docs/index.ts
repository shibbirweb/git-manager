// Every component's doc, in sidebar order. docs.test.ts checks that each component has exactly one.
import type { ComponentDoc } from "./types";
import { actionDocs } from "./actions";
import { editorDocs } from "./editor";
import { feedbackDocs } from "./feedback";
import { formDocs } from "./forms";
import { layoutDocs } from "./layout";
import { navigationDocs } from "./navigation";
import { overlayDocs } from "./overlays";
import { shellDocs } from "./shell";

export const componentDocs: ComponentDoc[] = [
  ...actionDocs,
  ...formDocs,
  ...feedbackDocs,
  ...overlayDocs,
  ...navigationDocs,
  ...layoutDocs,
  ...shellDocs,
  ...editorDocs,
];

export function docFor(name: string): ComponentDoc | null {
  return componentDocs.find((doc) => doc.name === name) ?? null;
}
