// Git LFS state per repository: installed, used, and its files, read once per status
// refresh of a repository on screen (never per file). The Changes list and the Files panel
// ask for it with `follow`; repositories that do not use LFS cost no git process.

import { untrack } from "svelte";
import { api } from "$lib/api";
import type { LfsStatus, RepoStatus } from "$lib/types";
import { dialogs } from "$lib/ui/dialog.svelte";
import { updates } from "$lib/update/updates.svelte";
import { needsLfsInstall } from "./lfsModel";

export const LFS_URL = "https://git-lfs.com";
const NOTICE_KEY = "git-manager.lfs.installNoticeShown";

function noticeShown(): boolean {
  try {
    return localStorage.getItem(NOTICE_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberNotice(): void {
  try {
    localStorage.setItem(NOTICE_KEY, "1");
  } catch {
    // Without storage it may show again next time; nothing else depends on it.
  }
}

class LfsStore {
  statuses = $state.raw<Record<string, LfsStatus>>({});
  /** The repository status each LFS state was read for. */
  private readFor = new Map<string, RepoStatus | null>();
  private running = new Set<string>();
  private queued = new Set<string>();
  private noticePending = false;

  /** Reads `repoRoot`'s LFS state again when its status object changed since the last read. */
  follow(repoRoot: string, status: RepoStatus | null): void {
    if (this.readFor.has(repoRoot) && this.readFor.get(repoRoot) === status) {
      return;
    }
    this.readFor.set(repoRoot, status);
    // Called from effects: reading this store's state here must not make them depend on it.
    untrack(() => void this.refresh(repoRoot));
  }

  async refresh(repoRoot: string): Promise<LfsStatus | null> {
    if (this.running.has(repoRoot)) {
      this.queued.add(repoRoot);
      return this.statuses[repoRoot] ?? null;
    }
    this.running.add(repoRoot);
    try {
      do {
        this.queued.delete(repoRoot);
        const status = await api.lfsStatus(repoRoot).catch(() => null);
        if (status) {
          this.statuses = { ...this.statuses, [repoRoot]: status };
          if (needsLfsInstall(status)) {
            this.offerInstall();
          }
        }
      } while (this.queued.has(repoRoot));
    } finally {
      this.running.delete(repoRoot);
    }
    return this.statuses[repoRoot] ?? null;
  }

  /** Forgets repositories that left the workspace. */
  retain(repoRoots: string[]): void {
    untrack(() => this.retainNow(repoRoots));
  }

  private retainNow(repoRoots: string[]): void {
    const keep = new Set(repoRoots);
    if (Object.keys(this.statuses).some((root) => !keep.has(root))) {
      this.statuses = Object.fromEntries(Object.entries(this.statuses).filter(([root]) => keep.has(root)));
    }
    for (const root of [...this.readFor.keys()]) {
      if (!keep.has(root)) {
        this.readFor.delete(root);
      }
    }
  }

  /** Once ever: a repository uses LFS but git-lfs is missing, so its files are only pointers. */
  private offerInstall(): void {
    if (this.noticePending || noticeShown()) {
      return;
    }
    this.noticePending = true;
    const show = async () => {
      // Never on top of another question; try again shortly.
      if (dialogs.active !== null) {
        setTimeout(() => void show(), 2000);
        return;
      }
      rememberNotice();
      const choice = await dialogs.choose<"open" | "later">({
        title: "Git LFS Is Not Installed",
        message:
          "This repository stores large files with Git LFS, but git-lfs is not installed. Those files show as small pointer files until you install it and run Pull LFS Objects.",
        options: [
          { value: "open", label: "Get Git LFS", description: LFS_URL },
          { value: "later", label: "Not Now" },
        ],
      });
      this.noticePending = false;
      if (choice === "open") {
        await updates.open(LFS_URL);
      }
    };
    void show();
  }
}

export const lfsStore = new LfsStore();
