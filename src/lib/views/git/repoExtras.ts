// The Submodules and LFS submenus added to a repository row's "..." menu in the Changes view.

import { api } from "$lib/api";
import type { SubmoduleInfo } from "$lib/types";
import type { MenuItem } from "$lib/ui/menu.svelte";
import { lfsMenuItems } from "./lfs/lfsActions";
import { lfsStore } from "./lfs/lfsStore.svelte";
import { submoduleMenuItems } from "./submodules/submoduleActions";

/** Puts the two submenus before the menu's last separator (Show Log stays last). */
export function insertBeforeLast(items: MenuItem[], extra: MenuItem[]): MenuItem[] {
  let index = -1;
  for (let position = items.length - 1; position >= 0; position--) {
    if ("separator" in items[position]) {
      index = position;
      break;
    }
  }
  if (index < 0) {
    return [...items, { separator: true }, ...extra];
  }
  return [...items.slice(0, index), ...extra, ...items.slice(index)];
}

export async function withRepoExtras(items: MenuItem[], repoRoot: string): Promise<MenuItem[]> {
  const [submodules, lfs] = await Promise.all([
    api.listSubmodules(repoRoot).catch(() => [] as SubmoduleInfo[]),
    lfsStore.statuses[repoRoot] ? Promise.resolve(lfsStore.statuses[repoRoot]) : lfsStore.refresh(repoRoot),
  ]);
  return insertBeforeLast(items, [
    { label: "Submodules", submenu: submoduleMenuItems(repoRoot, submodules) },
    { label: "LFS", submenu: lfsMenuItems(repoRoot, lfs ?? null) },
  ]);
}
