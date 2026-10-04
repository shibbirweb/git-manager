<script lang="ts">
  import { api } from "$lib/api";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import LayoutToggleIcon from "./LayoutToggleIcon.svelte";
  import { contextMenu, type MenuItem } from "$lib/ui/menu.svelte";
  import { recentEntries, shortPath } from "./recentEntries";
  import {
    openNewWindow,
    openRecent,
    openRecentInNewWindow,
    pickAndAddFolder,
    pickAndOpenInNewWindow,
    pickAndOpenRepo,
    pickAndOpenWorkspaceFile,
    pickAndSaveWorkspace,
  } from "./repoPicker";
  import { newBranchFrom } from "./sidebar/actions";
  import { navigation } from "$lib/stores/navigation.svelte";

  const head = $derived(repoStore.status?.head);
  const branchLabel = $derived(
    head?.branch ?? (head?.shortId ? `HEAD detached at ${head.shortId}` : "No branch"),
  );
  const busy = $derived(repoStore.busy !== null || repoStore.repo === null);
  // A separate repository picker only helps when the folder is not simply one repository.
  const showRepoPicker = $derived(
    repoStore.repos.length > 1 ||
      (repoStore.repos.length === 1 && repoStore.repos[0].root !== repoStore.workspace?.root),
  );

  function changeCount(repoRoot: string): number {
    return repoStore.statuses[repoRoot]?.files.length ?? 0;
  }

  function workspaceMenu(event: MouseEvent): void {
    const openRoots = repoStore.workspace?.folders.map((folder) => folder.root) ?? [];
    const recent = recentEntries(settings, { file: repoStore.workspace?.file ?? null, folderRoots: openRoots });
    const items: MenuItem[] = recent.map((entry) => ({ label: entry.label, hint: entry.hint, action: () => void openRecent(entry) }));
    if (items.length > 0) {
      items.push(
        {
          label: "Open Recent in New Window",
          submenu: recent.map((entry) => ({ label: entry.label, hint: entry.hint, action: () => void openRecentInNewWindow(entry) })),
        },
        { separator: true },
      );
    }
    items.push(
      { label: "New Window", action: () => void openNewWindow() },
      { label: "Open Folder...", action: () => void pickAndOpenRepo() },
      { label: "Open Folder in New Window...", action: () => void pickAndOpenInNewWindow() },
      { label: "Open Workspace from File...", action: () => void pickAndOpenWorkspaceFile() },
      { label: "Add Folder to Workspace...", action: () => void pickAndAddFolder() },
      {
        label: repoStore.workspace?.file ? "Save Workspace As..." : "Save Workspace to File...",
        hint: repoStore.workspace?.file ? shortPath(repoStore.workspace.file) : undefined,
        action: () => void pickAndSaveWorkspace(),
      },
    );
    if (openRoots.length > 1) {
      items.push({ separator: true });
      for (const folder of repoStore.workspace?.folders ?? []) {
        items.push({ label: `Remove "${folder.name}" from Workspace`, hint: shortPath(folder.root), action: () => void repoStore.removeFolder(folder.root) });
      }
    }
    items.push(
      { separator: true },
      { label: "Scan for Repositories", action: () => void repoStore.rediscover() },
      {
        label: openRoots.length > 1 ? "Close Workspace" : "Close Folder",
        action: () => void repoStore.closeWorkspace(),
      },
    );
    contextMenu.open(event, items);
  }

  function repoPickerMenu(event: MouseEvent): void {
    const items: MenuItem[] = repoStore.repos.map((repo) => {
      const count = changeCount(repo.root);
      const isActive = repo.root === repoStore.repo?.root;
      return {
        label: `${isActive ? "\u2713 " : "   "}${repo.name}`,
        hint: [repo.relativePath && repo.relativePath !== repo.name ? repo.relativePath : "", count > 0 ? `${count}` : ""]
          .filter(Boolean)
          .join("  "),
        action: () => void repoStore.setActiveRepo(repo.root),
      };
    });
    items.push({ separator: true }, { label: "Scan for Repositories", action: () => void repoStore.rediscover() });
    contextMenu.open(event, items);
  }

  function branchMenu(event: MouseEvent): void {
    const local = repoStore.refs?.local ?? [];
    const items: MenuItem[] = [
      { label: "New Branch...", action: () => void newBranch() },
      { separator: true },
      ...local.map((branch) => ({
        label: branch.isHead ? `${branch.name}  (current)` : branch.name,
        disabled: branch.isHead,
        action: () =>
          void repoStore.run("Checkout", (repoPath) => api.checkoutBranch(repoPath, branch.name), {
            success: `Switched to ${branch.name}`,
          }),
      })),
    ];
    contextMenu.open(event, items);
  }

  function newBranch(): Promise<void> {
    return newBranchFrom(null);
  }

  function toggleTheme(): void {
    const dark =
      settings.theme === "dark" ||
      (settings.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    settings.setTheme(dark ? "light" : "dark");
  }
</script>

<header class="header">
  <div class="left">
    <!-- Back / Forward through file locations, like VS Code's Go Back / Go Forward. -->
    <div class="history" role="group" aria-label="Navigation history">
      <button
        class="icon-btn history-btn"
        onclick={() => void navigation.goBack()}
        disabled={!navigation.canGoBack}
        title="Go Back (Ctrl+-)"
        aria-label="Go back"
      >
        <Icon name="arrow-left" size={15} />
      </button>
      <button
        class="icon-btn history-btn"
        onclick={() => void navigation.goForward()}
        disabled={!navigation.canGoForward}
        title="Go Forward (Ctrl+Shift+-)"
        aria-label="Go forward"
      >
        <Icon name="arrow-right" size={15} />
      </button>
    </div>
    <div class="divider"></div>
    <button class="pill" onclick={workspaceMenu} title={(repoStore.workspace?.folders ?? []).map((folder) => folder.root).join("\n")}>
      <Icon name="folder" size={14} />
      <span class="strong truncate">{repoStore.workspace?.name}</span>
      <Icon name="chevron-down" size={12} />
    </button>
    {#if showRepoPicker}
      <span class="sep">/</span>
      <button class="pill" onclick={repoPickerMenu} title="Active repository: {repoStore.repo?.root ?? 'none'}">
        <Icon name="folder-git" size={14} />
        <span class="truncate">{repoStore.repo?.name ?? "Select repository"}</span>
        <span class="repo-count dim">{repoStore.repos.length}</span>
        <Icon name="chevron-down" size={12} />
      </button>
    {/if}
    {#if repoStore.repo}
    <button class="pill" onclick={branchMenu} title="Branch: {branchLabel}. Click to switch branches">
      <Icon name="branch" size={14} />
      <span class="truncate branch-name">{branchLabel}</span>
      {#if head && (head.ahead > 0 || head.behind > 0)}
        <span class="counts dim">
          {#if head.ahead > 0}<span title="Commits to push">{head.ahead}<Icon name="arrow-up" size={11} /></span>{/if}
          {#if head.behind > 0}<span title="Commits to pull">{head.behind}<Icon name="arrow-down" size={11} /></span>{/if}
        </span>
      {/if}
      <Icon name="chevron-down" size={12} />
    </button>
    {:else}
      <span class="dim no-repo">No git repository</span>
    {/if}
  </div>


  <div class="right">
    {#if repoStore.busy}
      <div class="busy" title={repoStore.progress}>
        <span class="spinner"></span>
        <span class="truncate">{repoStore.progress || `${repoStore.busy}...`}</span>
      </div>
    {/if}
    <!-- Fetch, Pull, Push and Stash are in the Git menu. -->
    <!-- Like VS Code's layout controls: the filled side shows which edge bar is visible. -->
    <button
      class="icon-btn"
      onclick={() => settings.toggleActivityBar("left")}
      title="{settings.leftBarVisible ? 'Hide' : 'Show'} Left Activity Bar"
      aria-label="Toggle left activity bar"
      aria-pressed={settings.leftBarVisible}
    >
      <LayoutToggleIcon side="left" visible={settings.leftBarVisible} />
    </button>
    <button
      class="icon-btn"
      onclick={() => settings.toggleActivityBar("right")}
      title="{settings.rightBarVisible ? 'Hide' : 'Show'} Right Activity Bar"
      aria-label="Toggle right activity bar"
      aria-pressed={settings.rightBarVisible}
    >
      <LayoutToggleIcon side="right" visible={settings.rightBarVisible} />
    </button>
    <div class="divider"></div>
    <button class="icon-btn" onclick={toggleTheme} title="Toggle light/dark theme">
      <Icon name="sun" size={15} />
    </button>
    <button class="icon-btn" onclick={() => settings.openDialog()} title="Settings (Cmd+,)" aria-label="Settings">
      <Icon name="settings" size={15} />
    </button>
  </div>
</header>

<style>
  .header {
    display: grid;
    /* The left side shrinks (names truncate) so it never runs into the actions. */
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    height: 42px;
    padding: 0 8px;
    background: var(--panel);
    border-bottom: 1px solid var(--border-strong);
  }

  /* Rounded panels: the header is part of the window frame. */
  :global(html[data-rounded-panels]) .header {
    background: var(--frame);
    border-bottom: none;
  }

  .left,
  .right {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }

  .left {
    overflow: hidden;
  }

  .left > :global(*) {
    flex: 0 1 auto;
    min-width: 0;
  }

  .history,
  .left > .divider,
  .left > .sep {
    flex: none;
  }

  .right {
    justify-content: flex-end;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    max-width: 280px;
    min-width: 0;
    padding: 0 8px;
    border: none;
    border-radius: var(--radius);
    background: transparent;
    cursor: pointer;
  }

  .pill:hover {
    background: var(--hover);
  }

  .strong {
    font-weight: 600;
  }

  .sep {
    color: var(--text-faint);
  }

  .repo-count {
    font-size: 11px;
  }

  .no-repo {
    padding: 0 8px;
    font-size: 12px;
  }

  .branch-name {
    min-width: 0;
  }

  .counts {
    display: inline-flex;
    gap: 4px;
    font-size: 11.5px;
  }

  .counts span {
    display: inline-flex;
    align-items: center;
  }

  .history {
    display: flex;
    gap: 2px;
  }

  .history-btn {
    height: 26px;
    min-width: 26px;
  }












  .busy {
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 280px;
    margin-right: 6px;
    color: var(--text-dim);
    font-size: 12px;
  }

  .spinner {
    flex: none;
    width: 12px;
    height: 12px;
    border: 2px solid var(--border-strong);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .divider {
    width: 1px;
    height: 18px;
    margin: 0 4px;
    background: var(--border-strong);
  }
</style>
