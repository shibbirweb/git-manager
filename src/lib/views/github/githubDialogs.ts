// The GitHub submenu's dialogs. They open through gitDialogs (one Git dialog at a time, and
// the window shortcuts already wait behind it) and render in GitHubDialogHost.svelte.

import { gitDialogs } from "../git/gitDialogs.svelte";

export type GitHubDialog =
  /** Asked before an item that needs an account; `onSignedIn` continues with that item. */
  | { kind: "signIn"; actionLabel: string; onSignedIn: (() => void) | null }
  | { kind: "share"; repoRoot: string }
  | { kind: "gist"; fileName: string; content: string; fromSelection: boolean }
  | {
      kind: "result";
      title: string;
      message: string;
      /** A page to show with Copy and Open buttons. */
      url: string | null;
      openLabel: string;
      /** Shown under the message in the error color, e.g. why a push failed. */
      problem: string | null;
    };

export function openGitHubDialog(dialog: GitHubDialog): void {
  gitDialogs.open({ kind: "github", dialog });
}

export function closeGitHubDialog(): void {
  gitDialogs.close();
}
