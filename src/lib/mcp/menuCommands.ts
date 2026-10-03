// list_menu_commands: every action of the menu bar with its place in the menus and what the
// menu shows for it now (menuState.ts). Pure, from the same spec and state the menu uses.

import { isEditorAction, type MenuAction } from "$lib/menu/menuIds";
import type { MenuState } from "$lib/menu/menuState";
import type { MenuEntry, TopMenu } from "$lib/menu/menuSpec";

export interface MenuCommand {
  action: MenuAction;
  /** The item's text as the menu shows it now, e.g. "Push (2 ahead)...". */
  label: string;
  /** Where it is: "Git > Current File". */
  menuPath: string;
  accelerator: string | null;
  enabled: boolean;
  /** Only for items with a check mark. */
  checked?: boolean;
  /** False while the menu leaves the item out (operation items, Git Console off). */
  visible: boolean;
  /** Acts on the focused text editor (Find, Code menu). */
  editorCommand: boolean;
}

/** `accelerators`: the keys the menu shows now (custom keyboard shortcuts applied), by action. */
export function menuCommands(
  spec: TopMenu[],
  state: MenuState,
  accelerators: ReadonlyMap<MenuAction, string | null> = new Map(),
): MenuCommand[] {
  const commands: MenuCommand[] = [];
  const seen = new Set<MenuAction>();
  const walk = (entries: MenuEntry[], path: string[]) => {
    for (const entry of entries) {
      if (entry.kind === "submenu") {
        walk(entry.items, [...path, entry.text]);
        continue;
      }
      const item = entry.kind === "action" ? entry : entry.kind === "recent" ? entry.clear : null;
      const itemPath = entry.kind === "recent" ? [...path, entry.text] : path;
      if (!item || seen.has(item.action)) {
        continue;
      }
      seen.add(item.action);
      const itemState = state[item.action];
      commands.push({
        action: item.action,
        label: itemState?.text ?? item.text,
        menuPath: itemPath.join(" > "),
        accelerator: accelerators.has(item.action) ? (accelerators.get(item.action) ?? null) : item.accelerator,
        enabled: itemState?.enabled ?? true,
        ...(item.check ? { checked: itemState?.checked ?? false } : {}),
        visible: itemState?.visible ?? true,
        editorCommand: isEditorAction(item.action),
      });
    }
  };
  for (const top of spec) {
    walk(top.items, [top.text]);
  }
  return commands;
}
