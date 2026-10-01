<script lang="ts">
  import { api, errorMessage } from "$lib/api";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import { contextMenu, type MenuItem } from "$lib/ui/menu.svelte";
  import { pickAndAddFolder, pickAndOpenRepo, pickAndOpenWorkspaceFile, pickAndSaveWorkspace } from "./repoPicker";
  import { newBranchFrom } from "./sidebar/actions";
  import { navigation } from "$lib/stores/navigation.svelte";
  import type { AppError } from "$lib/types";

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

  function shortPath(folderPath: string): string {
    return folderPath.replace(/^\/Users\/[^/]+/, "~");
  }

  function folderName(folderPath: string): string {
    return folderPath.split("/").filter(Boolean).pop() ?? folderPath;
  }

  function workspaceMenu(event: MouseEvent): void {
    const openRoots = repoStore.workspace?.folders.map((folder) => folder.root) ?? [];
    const openKey = openRoots.join("\n");
    const items: MenuItem[] = [];
    // Recent workspace files, then multi-folder workspaces, then single folders.
    for (const file of settings.recentWorkspaceFiles) {
      if (file === repoStore.workspace?.file) {
        continue;
      }
      items.push({
        label: file.slice(file.lastIndexOf("/") + 1).replace(/\.(gitmanager|code)-workspace$/, ""),
        hint: "workspace file",
        action: () => void repoStore.openWorkspaceFile(file),
      });
    }
    for (const folders of settings.recentWorkspaces) {
      if (folders.join("\n") === openKey) {
        continue;
      }
      items.push({
        label: `${folders.map(folderName).slice(0, 3).join(", ")}${folders.length > 3 ? ` +${folders.length - 3}` : ""}`,
        hint: `${folders.length} folders`,
        action: () => void repoStore.openFolders(folders),
      });
    }
    for (const folderPath of settings.recentRepos) {
      if (openRoots.length === 1 && folderPath === openRoots[0]) {
        continue;
      }
      items.push({ label: folderName(folderPath), hint: shortPath(folderPath), action: () => void repoStore.open(folderPath) });
    }
    if (items.length > 0) {
      items.push({ separator: true });
    }
    items.push(
      { label: "Open Folder...", action: () => void pickAndOpenRepo() },
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

  function fetchAll(): void {
    void repoStore.runOp("Fetch", (repoPath) => api.fetchAll(repoPath), "Fetched all remotes");
  }

  function pull(): void {
    void repoStore.runOp("Pull", (repoPath) => api.pull(repoPath), "Pulled");
  }

  async function push(event: MouseEvent): Promise<void> {
    let force = false;
    if (event.altKey) {
      force = await dialogs.confirm({
        title: "Force Push",
        message: `Force push ${head?.branch ?? "this branch"} with --force-with-lease?`,
        confirmLabel: "Force Push",
        danger: true,
      });
      if (!force) {
        return;
      }
    }
    void repoStore.runOp("Push", (repoPath) => api.push(repoPath, force), "Pushed");
  }

  async function stash(): Promise<void> {
    const result = await dialogs.prompt({
      title: "Stash Changes",
      label: "Message",
      placeholder: "WIP",
      initial: "WIP",
      confirmLabel: "Stash",
      checkbox: { label: "Include untracked files", checked: true },
    });
    if (!result) {
      return;
    }
    // Nothing to stash comes back as an "invalid" error: a note, not a failure.
    let nothingToStash: string | null = null;
    await repoStore.run(
      "Stash",
      async (repoPath) => {
        try {
          await api.stashPush(repoPath, result.value, result.checked);
          return true;
        } catch (error) {
          if ((error as Partial<AppError> | null)?.kind === "invalid") {
            nothingToStash = errorMessage(error);
            return false;
          }
          throw error;
        }
      },
      { success: (stashed) => (stashed ? "Changes stashed" : null) },
    );
    if (nothingToStash) {
      toast.info(nothingToStash);
    }
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
    <button class="icon-btn" onclick={fetchAll} disabled={busy} title="Fetch all remotes">
      <Icon name="refresh" size={15} />
    </button>
    <button class="icon-btn" onclick={pull} disabled={busy} title="Pull">
      <Icon name="arrow-down" size={15} />
      {#if head && head.behind > 0}<span class="count">{head.behind}</span>{/if}
    </button>
    <button class="icon-btn" onclick={push} disabled={busy} title="Push (Option-click to force push)">
      <Icon name="arrow-up" size={15} />
      {#if head && head.ahead > 0}<span class="count">{head.ahead}</span>{/if}
    </button>
    <button class="icon-btn" onclick={stash} disabled={busy} title="Stash changes">
      <Icon name="stash" size={15} />
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












  .count {
    font-size: 11px;
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
