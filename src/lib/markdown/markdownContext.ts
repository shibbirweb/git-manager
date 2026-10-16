// What the Markdown preview and the rich editor both need from the app: whether the page is dark (diagrams), how
// links resolve from a document, and which images may load (only from inside the workspace).
import type { LinkContext } from "@git-manager/ui/markdown/links";
import { configureDiagrams } from "@git-manager/ui/markdown/mermaid";
import { repoStore } from "$lib/stores/repo.svelte";
import { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME } from "$lib/themes/themeIndex";
import { folderFor, locateAbsolute } from "$lib/stores/workspacePaths";
import { markdownImageUrl } from "$lib/views/files/previewScheme";

// Diagrams draw in the app's own frame page (src/routes/mermaid-frame), and the two built-in themes keep
// mermaid's own looks.
configureDiagrams({ frameUrl: "/mermaid-frame", builtInThemes: [DEFAULT_LIGHT_THEME, DEFAULT_DARK_THEME] });

export function isDarkPage(): boolean {
  const theme = document.documentElement.getAttribute("data-theme");
  if (theme === "dark" || theme === "light") {
    return theme === "dark";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Links of the document at `documentPath` resolve from its repository (or folder) root. */
export function documentLinkContext(documentPath: string): LinkContext {
  const folders = repoStore.workspace?.folders ?? [];
  const rootPath =
    locateAbsolute(repoStore.repos, documentPath)?.repo.root ?? folderFor(folders, documentPath)?.root ?? "/";
  return {
    documentPath,
    rootPath,
    isInWorkspace: (absolutePath) => folderFor(folders, absolutePath) !== null,
  };
}

/** An image's preview URL; images outside the workspace never load. */
export async function workspaceImageUrl(imagePath: string): Promise<string> {
  if (!folderFor(repoStore.workspace?.folders ?? [], imagePath)) {
    throw new Error("Image outside the workspace");
  }
  return markdownImageUrl(imagePath);
}
