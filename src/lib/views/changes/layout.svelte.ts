// Collapse state and commit target of the Changes view, kept at module level
// so they survive switching to another tab and back.

import type { GroupId } from "./fileStatus";
import { groupKey } from "./sections";

/** Above this many clean repositories their list starts collapsed. */
const CLEAN_AUTO_COLLAPSE = 3;

class ChangesLayout {
  collapsedRepos = $state<Record<string, boolean>>({});
  collapsedGroups = $state<Record<string, boolean>>({});
  /** Null until the user toggles it; then the explicit choice. */
  cleanCollapsed = $state<boolean | null>(null);
  /** Repository the user last worked in; the commit box targets it. */
  commitTargetRoot = $state<string | null>(null);
  /** Active repository last seen, so a change of it moves the commit target. */
  seenActiveRoot: string | null = null;

  isRepoCollapsed(repoRoot: string): boolean {
    return this.collapsedRepos[repoRoot] ?? false;
  }

  toggleRepo(repoRoot: string): void {
    this.collapsedRepos[repoRoot] = !this.isRepoCollapsed(repoRoot);
  }

  isGroupCollapsed(repoRoot: string, group: GroupId): boolean {
    return this.collapsedGroups[groupKey(repoRoot, group)] ?? false;
  }

  toggleGroup(repoRoot: string, group: GroupId): void {
    const key = groupKey(repoRoot, group);
    this.collapsedGroups[key] = !(this.collapsedGroups[key] ?? false);
  }

  isCleanCollapsed(cleanCount: number): boolean {
    return this.cleanCollapsed ?? cleanCount > CLEAN_AUTO_COLLAPSE;
  }

  toggleClean(cleanCount: number): void {
    this.cleanCollapsed = !this.isCleanCollapsed(cleanCount);
  }

  focusRepo(repoRoot: string): void {
    if (this.commitTargetRoot !== repoRoot) {
      this.commitTargetRoot = repoRoot;
    }
  }
}

export const changesLayout = new ChangesLayout();
