// Git LFS state per repository: installed, used, and its files, read again only when HEAD,
// the index, entries or a .gitattributes may have changed (`repoStore.treeVersions`), never per
// file or per content edit. The Changes list and the Files panel ask for it with `follow`; each
// read sends the stamp of the last answer, so an unchanged repository costs a few file checks and
// no git-lfs process. Repositories that do not use LFS cost no git process, and the backend
// checks that git-lfs is installed once per app run (again only before an LFS action).

import { untrack } from "svelte";
import { api } from "$lib/api";
import type { LfsStatus } from "$lib/types";
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
  /** The `repoStore.treeVersions` value each LFS state was read for. */
  private readFor = new Map<string, number>();
  /** The stamp of each repository's last answer. */
  private stamps = new Map<string, string>();
  /** Repositories whose next read is a full one (an LFS action asked), not a stamp check. */
  private fullReads = new Set<string>();
  private running = new Map<string, Promise<void>>();
  private queued = new Set<string>();
  /** Repositories whose next read also checks that git-lfs is installed. */
  private installChecks = new Set<string>();
  private noticePending = false;

  /** Checks `repoRoot`'s LFS state again when its `treeVersion` (`repoStore.treeVersions`) moved since the last check. */
  follow(repoRoot: string, treeVersion: number): void {
    if (this.readFor.get(repoRoot) === treeVersion) {
      return;
    }
    this.readFor.set(repoRoot, treeVersion);
    // Called from effects: reading this store's state here must not make them depend on it.
    untrack(() => void this.read(repoRoot, false));
  }

  /**
   * Reads the LFS state in full (around LFS actions and for a first look); `checkInstall` asks again whether git-lfs
   * is installed, before an LFS action.
   */
  refresh(repoRoot: string, checkInstall = false): Promise<LfsStatus | null> {
    this.fullReads.add(repoRoot);
    if (checkInstall) {
      this.installChecks.add(repoRoot);
    }
    return this.read(repoRoot, checkInstall);
  }

  private async read(repoRoot: string, checkInstall: boolean): Promise<LfsStatus | null> {
    const pending = this.running.get(repoRoot);
    if (pending) {
      this.queued.add(repoRoot);
      // An LFS action needs the answer of the read it queued, not the state from before.
      if (checkInstall) {
        await pending;
      }
      return this.statuses[repoRoot] ?? null;
    }
    const reads = this.readLoop(repoRoot);
    this.running.set(repoRoot, reads);
    try {
      await reads;
    } finally {
      this.running.delete(repoRoot);
    }
    return this.statuses[repoRoot] ?? null;
  }

  private async readLoop(repoRoot: string): Promise<void> {
    do {
      this.queued.delete(repoRoot);
      const check = this.installChecks.delete(repoRoot);
      const full = this.fullReads.delete(repoRoot) || !(repoRoot in this.statuses);
      const known = full ? null : (this.stamps.get(repoRoot) ?? null);
      const status = await api.lfsStatus(repoRoot, check, known).catch(() => null);
      if (status) {
        this.stamps.set(repoRoot, status.stamp);
      }
      if (status && !status.unchanged) {
        this.statuses = { ...this.statuses, [repoRoot]: status };
        if (needsLfsInstall(status)) {
          this.offerInstall();
        }
      }
    } while (this.queued.has(repoRoot));
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
    for (const root of [...this.readFor.keys(), ...this.stamps.keys()]) {
      if (!keep.has(root)) {
        this.readFor.delete(root);
        this.stamps.delete(root);
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
