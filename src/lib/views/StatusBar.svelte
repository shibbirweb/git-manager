<!-- Bottom status bar: repository state on the left, the editor's caret, jobs and app memory on the right. -->
<script lang="ts">
  import Spinner from "@git-manager/ui/components/Spinner.svelte";
  import LibraryStatusBar from "@git-manager/ui/components/StatusBar.svelte";
  import StatusItem from "@git-manager/ui/components/StatusItem.svelte";
  import AiUsage from "$lib/ai/AiUsage.svelte";
  import KeepAwake from "$lib/ai/KeepAwake.svelte";
  import NotificationBell from "$lib/notifications/NotificationBell.svelte";
  import { autoFetch } from "$lib/stores/autoFetch.svelte";
  import { branchTabPath } from "$lib/stores/branchTabs";
  import { editorStatus } from "$lib/stores/editorStatus.svelte";
  import { loadingChangesText } from "$lib/stores/openingProgress";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { contextMenu } from "$lib/ui/menu.svelte";
  import { updates } from "$lib/update/updates.svelte";
  import { openBranchPicker, syncFromRow } from "./changes/repoActions";
  import { changesSelection } from "./changes/selection.svelte";
  import { rowSync, rowSyncBadge, rowSyncTooltip } from "./changes/sync";
  import MemoryStatus from "./MemoryStatus.svelte";
  import { currentScreenRepo, openRepoPicker } from "./repoSelection.svelte";

  // The left side describes the active repository. With Auto (the
  // default) that follows the open tab, and a file outside every repository says so.
  const screen = $derived(currentScreenRepo());
  const contextRepo = $derived.by(() => {
    if (settings.activeRepoAuto && screen.kind === "repo") {
      return repoStore.repos.find((repo) => repo.root === screen.repoRoot) ?? null;
    }
    if (settings.activeRepoAuto && screen.kind === "outside") {
      return null;
    }
    return repoStore.repo;
  });
  const contextStatus = $derived(contextRepo ? (repoStore.statuses[contextRepo.root] ?? null) : null);
  const head = $derived(contextStatus?.head ?? null);
  const branch = $derived(head?.branch ?? (head?.shortId ? `detached ${head.shortId}` : null));
  const changes = $derived(contextStatus?.files.length ?? 0);
  const conflicts = $derived(contextStatus?.files.filter((file) => file.conflicted).length ?? 0);
  const op = $derived(contextStatus?.op ?? null);
  // The Synchronize Changes item: sync with the upstream, or publish a branch without one.
  const sync = $derived(rowSync(head));
  const syncBadge = $derived(rowSyncBadge(sync));
  let syncing = $state(false);
  /** A file tab is on screen and outside every repository. */
  const fileWithoutRepo = $derived(settings.activeRepoAuto && screen.kind === "outside");
  const fileInfo = $derived(
    changesSelection.shownView === "file" && editorStatus.info && editorStatus.info.filePath === repoStore.openFilePath
      ? editorStatus.info
      : null,
  );
  const caret = $derived.by(() => {
    if (!fileInfo) {
      return "";
    }
    const lines = fileInfo.selectedLines > 1 ? `, ${fileInfo.selectedLines} lines` : "";
    const selected = fileInfo.selected > 0 ? ` (${fileInfo.selected} selected${lines})` : "";
    return `Ln ${fileInfo.line}, Col ${fileInfo.column}${selected}`;
  });

  async function runSync(repoRoot: string): Promise<void> {
    syncing = true;
    try {
      await syncFromRow(repoRoot);
    } finally {
      syncing = false;
    }
  }

  /** Bug report or feature request, opened above the button. */
  function openFeedbackMenu(event: MouseEvent): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    contextMenu.open(new MouseEvent("contextmenu", { clientX: rect.right - 200, clientY: rect.top - 76 }), [
      { label: "Report a Bug", hint: "GitHub issue", action: () => void updates.reportBug() },
      { label: "Request a Feature", hint: "GitHub issue", action: () => void updates.requestFeature() },
    ]);
  }
</script>

<LibraryStatusBar look={settings.roundedPanels ? "rounded" : "flat"}>
  {#snippet start()}
    {#if contextRepo}
      {@const repoRoot = contextRepo.root}
      <StatusItem
        icon="folder-git"
        text={contextRepo.name}
        title="Repository {repoRoot}{settings.activeRepoAuto ? ' (Auto)' : ''}. Click to select a repository."
        onclick={() => void openRepoPicker()}
      />
      {#if branch}
        <StatusItem
          icon="branch"
          text={branch}
          limit="branch"
          title="Branch {branch} of {contextRepo.name}. Click to check out another branch."
          onclick={() => openBranchPicker(repoRoot)}
        />
      {/if}
      {#if sync.kind !== "hidden"}
        <StatusItem
          icon={sync.kind === "publish" ? "cloud-upload" : "sync"}
          text={syncBadge ?? ""}
          spin={syncing}
          disabled={repoStore.busy !== null || (op?.kind ?? "none") !== "none"}
          title={rowSyncTooltip(sync)}
          label={sync.kind === "publish" ? "Publish Branch" : "Synchronize Changes"}
          onclick={() => void runSync(repoRoot)}
        />
      {/if}
      {#if changes > 0}
        <StatusItem
          icon="git-compare"
          text="{changes} {changes === 1 ? 'change' : 'changes'}"
          title="Changed files in {contextRepo.name}. Click to see them in a tab."
          onclick={() => repoStore.openPseudoTab(branchTabPath({ kind: "changes", repoRoot }))}
        />
      {/if}
      {#if conflicts > 0}
        <StatusItem
          icon="alert"
          tone="danger"
          text="{conflicts} {conflicts === 1 ? 'conflict' : 'conflicts'}"
          title="Resolve conflicts in {contextRepo.name}"
          onclick={() => void repoStore.openConflicts(repoRoot)}
        />
      {/if}
      {#if op && op.kind !== "none"}
        <StatusItem text={op.description} limit="operation" />
      {/if}
    {:else if fileWithoutRepo}
      {#if repoStore.repos.length > 0}
        <StatusItem
          icon="folder"
          text="No repository"
          title="This file is not inside a git repository. Click to select a repository."
          onclick={() => void openRepoPicker()}
        />
      {:else}
        <StatusItem icon="folder" text="No repository" title="This file is not inside a git repository" />
      {/if}
    {:else if repoStore.workspace}
      <StatusItem icon="folder" text={repoStore.workspace.name} />
    {/if}
    {#if settings.aiUsagePosition === "left"}
      <AiUsage side="left" />
    {/if}
  {/snippet}
  {#snippet end()}
    {#if fileInfo}
      <StatusItem text={caret} title="Cursor position" />
      <StatusItem
        text="{fileInfo.indentTabs ? 'Tab Size' : 'Spaces'}: {fileInfo.tabSize}"
        title={fileInfo.indentDetected
          ? "Indentation detected from the file (Settings > Editor)"
          : "Indentation (change in Settings > Editor)"}
        onclick={() => settings.openDialog("editor")}
      />
      <StatusItem text={fileInfo.eol === "crlf" ? "CRLF" : "LF"} title="Line endings" />
      <StatusItem text={fileInfo.language} title="Language" />
    {/if}
    {#if autoFetch.hint}
      <StatusItem
        icon="cloud"
        tone="warning"
        text={autoFetch.hint.text}
        title={autoFetch.hint.title}
        onclick={() => autoFetch.retryNow()}
      />
    {/if}
    {#if updates.available}
      <StatusItem
        icon="arrow-down"
        tone="accent"
        text="Update available: {updates.available.version}{updates.available.prerelease ? ' (beta)' : ''}"
        title="See what's new and download"
        onclick={() => (updates.dialogOpen = true)}
      />
    {/if}
    {#if repoStore.busy}
      <StatusItem text="{repoStore.busy}...">
        {#snippet leading()}<Spinner size="small" label={repoStore.busy ?? "Working"} />{/snippet}
      </StatusItem>
    {:else if repoStore.loadingChanges}
      <StatusItem
        text={loadingChangesText(repoStore.loadingChanges.done, repoStore.loadingChanges.total)}
        title="Reading the changes of each repository; you can already work"
      >
        {#snippet leading()}<Spinner size="small" label="Reading changes" />{/snippet}
      </StatusItem>
    {/if}
    {#if settings.aiUsagePosition === "right"}
      <AiUsage side="right" />
    {/if}
    <KeepAwake />
    <NotificationBell />
    <StatusItem
      icon="star"
      label="Star on GitHub"
      title="Star Git Manager on GitHub"
      onclick={() => void updates.openRepository()}
    />
    <StatusItem
      icon="bug"
      label="Report an issue"
      title="Report a bug or request a feature"
      onclick={openFeedbackMenu}
    />
    <MemoryStatus />
  {/snippet}
</LibraryStatusBar>
