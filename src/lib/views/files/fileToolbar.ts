// Which parts of a file tab's toolbar show (Settings > Appearance > File toolbar): where the
// bar goes, a switch per part, and what the file allows (git buttons need a repository,
// the view switch a Markdown file). Pure, so FileView only reads the answer.

import type { FileToolbarPlacement } from "$lib/stores/settingsData";

export interface FileToolbarSwitches {
  breadcrumbs: boolean;
  badges: boolean;
  changes: boolean;
  blame: boolean;
  copyPath: boolean;
  markdownView: boolean;
  markdownFormat: boolean;
}

export interface FileToolbarFile {
  /** Inside a git repository and editable: change arrows and Blame apply. */
  gitTools: boolean;
  /** An editable Markdown file: the view switch and the formatting row apply. */
  markdown: boolean;
}

export interface FileToolbarParts {
  /** The bar itself: placed, and at least one part on. */
  shown: boolean;
  breadcrumbs: boolean;
  badges: boolean;
  changes: boolean;
  blame: boolean;
  copyPath: boolean;
  markdownView: boolean;
  /** The Markdown formatting row under the bar; it has its own row, so placement does not hide it. */
  markdownFormat: boolean;
}

export function fileToolbarParts(placement: FileToolbarPlacement, switches: FileToolbarSwitches, file: FileToolbarFile): FileToolbarParts {
  const placed = placement !== "none";
  const parts = {
    breadcrumbs: placed && switches.breadcrumbs,
    badges: placed && switches.badges,
    changes: placed && switches.changes && file.gitTools,
    blame: placed && switches.blame && file.gitTools,
    copyPath: placed && switches.copyPath,
    markdownView: placed && switches.markdownView && file.markdown,
  };
  return {
    ...parts,
    shown: Object.values(parts).some(Boolean),
    markdownFormat: switches.markdownFormat && file.markdown,
  };
}
