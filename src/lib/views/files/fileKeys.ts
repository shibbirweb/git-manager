// Keys a file editor handles itself: Save, F7 / Shift+F7 between changes, and Markdown's bold, italic and link.
import type { Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { usesDefaultKeys } from "$lib/commands/commandRuntime";
import { toggleInline, toggleLink } from "@nibtree/ui/markdown/format";

export interface FileKeyActions {
  save: () => void;
  /** Next (1) or previous (-1) change or conflict; false when there is none. */
  goToSection: (direction: 1 | -1) => boolean;
}

export function fileKeys(markdown: boolean, actions: FileKeyActions): Extension[] {
  const saveKeys = keymap.of([
    {
      key: "Mod-s",
      // With a custom key for Save, Cmd+S is free and the custom key runs File > Save.
      run: () => {
        if (!usesDefaultKeys("file.save")) {
          return false;
        }
        actions.save();
        return true;
      },
    },
  ]);
  const navKeys = keymap.of([
    { key: "F7", run: () => actions.goToSection(1) },
    { key: "Shift-F7", run: () => actions.goToSection(-1) },
  ]);
  return markdown ? [saveKeys, markdownKeys(), navKeys] : [saveKeys, navKeys];
}

// Cmd+B makes text bold here, like the rich editor: CodeMirror prevents the key's default,
// so the window's sidebar toggle and the View > Sidebar item skip it. Cmd+I replaces Select
// Parent Syntax and Cmd+K (Git > Commit elsewhere) is seen here first.
function markdownKeys(): Extension {
  return keymap.of([
    {
      key: "Mod-b",
      preventDefault: true,
      run: (target) => {
        target.dispatch(toggleInline(target.state, "bold"));
        return true;
      },
    },
    {
      key: "Mod-i",
      preventDefault: true,
      run: (target) => {
        target.dispatch(toggleInline(target.state, "italic"));
        return true;
      },
    },
    {
      key: "Mod-k",
      preventDefault: true,
      run: (target) => {
        target.dispatch(toggleLink(target.state));
        return true;
      },
    },
  ]);
}
