// Commit message drafts per repository, kept outside the components so
// switching views or commit targets does not lose them. Reset when another
// workspace is opened.

import { DraftBook } from "./drafts";

export class CommitDraft {
  message = $state("");
  amend = $state(false);
  /** Message loaded from HEAD for amend, used to clear it again on uncheck. */
  prefilled = $state<string | null>(null);
  /** The `commit.template` text put into the empty box, so it still counts as empty. */
  template = $state<string | null>(null);
  /** The template's comment lines, shown as the placeholder. */
  templateHint = $state<string | null>(null);
  /** `commit.template` was looked up since the box was last emptied by a commit. */
  templateChecked = $state(false);

  /** Nothing typed: empty, or only the untouched `commit.template` text. */
  isBlank(): boolean {
    return this.message.trim() === "" || (this.template !== null && this.message === this.template);
  }

  clear(): void {
    this.message = "";
    this.amend = false;
    this.prefilled = null;
    this.template = null;
    this.templateHint = null;
    this.templateChecked = false;
  }
}

class CommitDrafts {
  private workspaceRoot: string | null = null;
  private readonly book = new DraftBook(() => new CommitDraft());
  /** Bumped when drafts are dropped so readers pick up fresh ones. */
  private version = $state(0);

  /** Resets drafts for a new workspace and drops those of vanished repositories. */
  sync(workspaceRoot: string | null, repoRoots: string[]): void {
    if (workspaceRoot !== this.workspaceRoot) {
      this.workspaceRoot = workspaceRoot;
      this.book.clear();
      this.version++;
      return;
    }
    if (this.book.prune(repoRoots) > 0) {
      this.version++;
    }
  }

  for(repoRoot: string): CommitDraft {
    void this.version;
    return this.book.get(repoRoot);
  }
}

export const commitDraft = new CommitDrafts();
