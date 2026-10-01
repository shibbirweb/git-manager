// Asks GitHub every few hours whether a newer release exists on this build's
// channel, and shows What's New once after an update. Notify only: nothing is
// downloaded or installed. An offline check fails quietly and tries again later.
// Neither runs in git mergetool mode, a short-lived window git opens per file.

import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api, errorMessage } from "$lib/api";
import { settings } from "$lib/stores/settings.svelte";
import { toast } from "$lib/ui/toast.svelte";
import {
  announcedRelease,
  bugReportUrl,
  type Channel,
  defaultChannel,
  featureRequestUrl,
  isSkipped,
  newerReleases,
  osLabel,
  parseReleases,
  platformName,
  type Release,
  RELEASES_URL,
  REPOSITORY,
  REPOSITORY_URL,
} from "./releases";
import { compareVersions } from "./version";

/** Often enough to notice a release the same day, far inside GitHub's 60 requests an hour. */
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Starting the app never waits on the network. */
const FIRST_CHECK_DELAY_MS = 30 * 1000;
const REQUEST_TIMEOUT_MS = 20 * 1000;

async function isMergetoolLaunch(): Promise<boolean> {
  try {
    return (await api.getLaunchMode()).mode === "mergeTool";
  } catch {
    return false;
  }
}

/** The OS for bug reports. The user agent is only a fallback: WebKit freezes the macOS version in it. */
async function currentPlatform(): Promise<string> {
  try {
    return osLabel(await api.osInfo()) ?? platformName(navigator.userAgent);
  } catch {
    return platformName(navigator.userAgent);
  }
}

class UpdateStore {
  /** This build's version, e.g. "0.2.0" or "0.3.0-beta.1". */
  current = $state<string | null>(null);
  /** Newer releases on the channel, newest first. */
  newer = $state.raw<Release[]>([]);
  checking = $state(false);
  checkedAt = $state<number | null>(null);
  error = $state<string | null>(null);
  dialogOpen = $state(false);
  whatsNewOpen = $state(false);

  private timer: ReturnType<typeof setTimeout> | undefined;
  private automatic = true;

  get channel(): Channel {
    if (settings.updateChannel === "stable" || settings.updateChannel === "beta") {
      return settings.updateChannel;
    }
    return defaultChannel(this.current ?? "0.0.0");
  }

  /** The release to announce: the newest one, unless the user skipped it. */
  get available(): Release | null {
    return announcedRelease(this.newer, settings.skippedVersion);
  }

  /** The newest release is one the user skipped: a manual check says so instead of announcing it. */
  get newestSkipped(): boolean {
    const newest = this.newer[0] ?? null;
    return newest !== null && isSkipped(newest, settings.skippedVersion);
  }

  async init(): Promise<void> {
    try {
      this.current = await getVersion();
    } catch {
      this.current = null;
      return;
    }
    if (await isMergetoolLaunch()) {
      // Leave lastRunVersion alone so the next normal start still shows What's New.
      this.automatic = false;
      return;
    }
    // Once after an update, show what changed in this version.
    const previous = settings.lastRunVersion;
    if (previous && compareVersions(this.current, previous) > 0) {
      this.whatsNewOpen = true;
    }
    if (previous !== this.current) {
      settings.lastRunVersion = this.current;
      settings.save();
    }
    this.schedule(FIRST_CHECK_DELAY_MS);
  }

  /** (Re)arms the automatic check; turning the setting off simply lets it lapse. */
  schedule(delayMs = CHECK_INTERVAL_MS): void {
    clearTimeout(this.timer);
    if (!this.automatic) {
      return;
    }
    this.timer = setTimeout(async () => {
      if (settings.checkForUpdates) {
        await this.check(false);
      }
      this.schedule(CHECK_INTERVAL_MS);
    }, delayMs);
  }

  /** Asks GitHub now. A manual check reports its result; an automatic one stays quiet. */
  async check(manual: boolean): Promise<void> {
    if (!this.current || this.checking) {
      return;
    }
    this.checking = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/releases?per_page=30`, {
        headers: { Accept: "application/vnd.github+json" },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(response.status === 403 ? "GitHub rate limit reached, try again later" : `GitHub answered ${response.status}`);
      }
      this.newer = newerReleases(this.current, this.channel, parseReleases(await response.json()));
      this.checkedAt = Date.now();
      this.error = null;
      if (manual) {
        // A skipped newest release opens the dialog too, marked as skipped.
        if (this.newer.length > 0) {
          this.dialogOpen = true;
        } else {
          toast.success("Git Manager is up to date", `Version ${this.current} on the ${this.channel} channel.`);
        }
      }
    } catch (error) {
      this.error = controller.signal.aborted ? "The update check timed out" : errorMessage(error);
      if (manual) {
        toast.error("Could not check for updates", this.error);
      }
    } finally {
      clearTimeout(timeout);
      this.checking = false;
    }
  }

  skip(release: Release): void {
    settings.skippedVersion = release.version;
    settings.save();
    this.dialogOpen = false;
  }

  /** Announces the skipped version again. */
  unskip(): void {
    settings.skippedVersion = null;
    settings.save();
  }

  /** Opens the download for this platform, or the release page. */
  async download(release: Release): Promise<void> {
    await this.open(release.downloadUrl ?? release.url);
  }

  async open(url: string): Promise<void> {
    try {
      await openUrl(url);
    } catch (error) {
      toast.error("Could not open the browser", errorMessage(error));
    }
  }

  openReleasesPage(): Promise<void> {
    return this.open(RELEASES_URL);
  }

  /** The repository page, where people can star it. */
  openRepository(): Promise<void> {
    return this.open(REPOSITORY_URL);
  }

  async reportBug(): Promise<void> {
    await this.open(bugReportUrl(this.current, await currentPlatform()));
  }

  requestFeature(): Promise<void> {
    return this.open(featureRequestUrl());
  }
}

export const updates = new UpdateStore();
