// The open project's color, the same as its tile on the Welcome page: the open workspace's id is the key the
// Welcome list colors the entry by (the workspace file, or the folder roots joined).
import type { ProjectTint } from "@git-manager/ui/logic/presets";
import { badgeColor } from "$lib/views/welcomeModel";

export function projectTintFor(enabled: boolean, workspaceId: string | null): ProjectTint {
  return enabled && workspaceId ? badgeColor(workspaceId) : "none";
}
