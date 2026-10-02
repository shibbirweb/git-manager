// Commit Options state: sign-off and GPG signing are settings (settings.json); the author
// and Skip hooks are kept per repository for this session only, like JetBrains' commit
// dialog. Every commit path asks `commitOptions.request(repoRoot)` for what to send.

import { settings } from "$lib/stores/settings.svelte";
import type { CommitOptions, GpgSign } from "$lib/types";
import { toast } from "$lib/ui/toast.svelte";
import { commitRequest, validateAuthor } from "./commitOptions";

interface SessionOptions {
  author: string;
  noVerify: boolean;
}

const EMPTY: SessionOptions = { author: "", noVerify: false };

class CommitOptionsStore {
  private session = $state<Record<string, SessionOptions>>({});

  /** The options the next commit in `repoRoot` uses, the author as typed. */
  for(repoRoot: string): CommitOptions {
    const own = this.session[repoRoot] ?? EMPTY;
    return {
      signOff: settings.commitSignOff,
      author: own.author,
      gpgSign: settings.commitGpgSign,
      noVerify: own.noVerify,
    };
  }

  private update(repoRoot: string, change: Partial<SessionOptions>): void {
    this.session[repoRoot] = { ...(this.session[repoRoot] ?? EMPTY), ...change };
  }

  setAuthor(repoRoot: string, author: string): void {
    this.update(repoRoot, { author });
  }

  setNoVerify(repoRoot: string, noVerify: boolean): void {
    this.update(repoRoot, { noVerify });
  }

  setSignOff(signOff: boolean): void {
    settings.setPreference("commitSignOff", signOff);
  }

  setGpgSign(gpgSign: GpgSign): void {
    settings.setPreference("commitGpgSign", gpgSign);
  }

  /** What to send with a commit, or null (with a notice) while the author is not valid. */
  request(repoRoot: string): CommitOptions | null {
    const options = this.for(repoRoot);
    const error = validateAuthor(options.author ?? "");
    if (error) {
      toast.info("Check the commit author", `${error} (Commit Options)`);
      return null;
    }
    return commitRequest(options);
  }
}

export const commitOptions = new CommitOptionsStore();
